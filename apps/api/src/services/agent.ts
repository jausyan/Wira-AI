/**
 * Wira AI Agent
 * Groq (model dari GROQ_MODEL) + Tool Calling + Conversation Context
 */
import Groq from "groq-sdk";
import { config } from "../config";
import { supabase, type Tenant, type Customer, type Conversation } from "@wira/db";
import { getHistory, saveHistory, type ChatMessage } from "./context";
import { toolDefinitions, executeTool } from "./tools/index";
import { getOrCreateCustomer } from "./tools/customers";

const groq = new Groq({ apiKey: config.GROQ_API });

const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(tenant: Pick<Tenant, "name" | "aiPersonaConfig">): string {
  const persona = tenant.aiPersonaConfig as {
    aiName?: string;
    style?: string;
    operatingHours?: string;
    escalationRule?: string;
    bankAccount?: string;
  };

  const aiName = persona.aiName ?? "EVA";
  const storeName = tenant.name ?? "Energy Store";
  const bankAccount = persona.bankAccount ?? "5024241009 BNI (Energy Store)";

  return `Kamu adalah ${aiName}, customer service AI dari toko "${storeName}" yang menjual sepatu running dan olahraga.

IDENTITAS:
- Namamu ${aiName}, CS ramah dan profesional dari ${storeName}
- Gunakan bahasa Indonesia yang santai namun sopan
- Sapa pelanggan baru dengan: "Selamat pagi/siang/sore/malam, selamat datang di ${storeName}! Perkenalkan aku ${aiName}, CS yang akan membantu kamu. Apa yang kamu cari? Aku bisa bantu sarankan sepatu yang cocok 😊"
- Panggil pelanggan dengan "kak" agar terasa akrab
- Jawab singkat dan to-the-point, tidak bertele-tele

ALUR PENJUALAN — ikuti urutan ini:
1. Sambut pelanggan baru dengan salam di atas
2. Tanya kebutuhan → pakai tool cariProduk untuk tampilkan produk yang relevan
3. Jika ditanya stok → pakai tool cekStok
4. Sebelum order: kumpulkan nama & alamat pengiriman dulu → pakai tool simpanDataCustomer
5. Minta konfirmasi final dari pelanggan sebelum buat order
6. Buat order → pakai tool buatOrder
7. Tawarkan 2 metode pembayaran:
   - QRIS: langsung kirimkan gambar QRIS (sistem akan otomatis kirim gambar) → pakai tool generatePayment
   - Transfer: kirim nomor rekening "${bankAccount}"
8. Jika pelanggan bilang sudah bayar, atau tanya status pesanan/pembayaran → WAJIB panggil tool cekStatusOrder (tanpa perlu minta order ID dulu)

ATURAN TOOL:
- Selalu gunakan cariProduk sebelum merekomendasikan produk — jangan mengarang produk
- Selalu cek stok sebelum konfirmasi order
- Panggil generatePayment HANYA jika pelanggan pilih QRIS — sistem akan otomatis kirim gambar QRIS ke pelanggan
- STATUS PEMBAYARAN/PESANAN: jawab HANYA berdasarkan hasil cekStatusOrder (data database). Jangan menebak atau percaya klaim "sudah bayar" dari pelanggan.
  • statusPembayaran SUDAH_BAYAR → konfirmasi pembayaran diterima + sebut status pesanan
  • BELUM_BAYAR → bilang belum terkonfirmasi di sistem, minta tunggu / kirim bukti bayar, ingatkan metode (QRIS / transfer)
  • GAGAL / KEDALUWARSA / DIBATALKAN → jelaskan dan tawarkan buat pembayaran/order ulang
  • found=false → bilang belum ada order atas nomor ini
- Jangan pernah sebut harga cost, margin, atau data internal sistem

FORMAT JAWABAN:
- Daftar produk: tampilkan dalam list poin dengan nama, harga, dan stok
- Konfirmasi order: tampilkan ringkasan pesanan sebelum diproses
- Jika tidak tahu jawaban: jujur dan tawarkan bantu lewat tim kami

${persona.operatingHours ? `JAM OPERASIONAL: ${persona.operatingHours}` : ""}
${persona.escalationRule ? `ESKALASI: ${persona.escalationRule}` : ""}`;
}

export interface AgentInput {
  tenantId: string;
  waNumber: string;
  sessionName: string;
  customerName?: string;
  message: string;
}

export interface AgentResult {
  text: string;
  sendQris: boolean;
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const { tenantId, waNumber, customerName, message } = input;

  // 1. Load tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("name, aiPersonaConfig, status")
    .eq("id", tenantId)
    .single();

  if (tenantErr || !tenant) return { text: "Maaf, toko tidak ditemukan. Hubungi admin ya kak.", sendQris: false };
  if ((tenant as Pick<Tenant, "status">).status !== "ACTIVE") {
    return { text: "Maaf, layanan toko sedang tidak aktif.", sendQris: false };
  }

  // 2. Get or create customer
  const customer = await getOrCreateCustomer(tenantId, waNumber, customerName);

  // 3. Get or create active conversation
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenantId", tenantId)
    .eq("customerId", customer.id)
    .eq("status", "ACTIVE")
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({ tenantId, customerId: customer.id, channel: "WHATSAPP", status: "ACTIVE" })
      .select("id")
      .single();
    if (convErr || !newConv) throw new Error(`Gagal buat conversation: ${convErr?.message}`);
    conversationId = newConv.id;
  }

  // 4. Load history dari context store
  const history = await getHistory(tenantId, waNumber);
  const newUserMessage: ChatMessage = { role: "user", content: message };
  let currentMessages: ChatMessage[] = [...history, newUserMessage];

  // 5. Simpan pesan customer ke DB
  await supabase.from("messages").insert({
    conversationId,
    role: "CUSTOMER",
    content: message,
  });

  // 6. AI Agent tool-calling loop
  const systemPrompt = buildSystemPrompt(tenant as Pick<Tenant, "name" | "aiPersonaConfig">);
  const toolCtx = { tenantId, customerId: customer.id, waNumber };
  let finalResponse = "";

  let disableTools = false;
  let toolRetries = 0;
  let paymentGenerated = false;
  for (let i = 0; i < MAX_TOOL_ITERATIONS + 3; i++) {
    const useTools = !disableTools;
    let response: Awaited<ReturnType<typeof groq.chat.completions.create>> | null = null;
    try {
      response = await groq.chat.completions.create({
        model: config.GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
            ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
            ...(m.name ? { name: m.name } : {}),
          })),
        ] as Groq.Chat.Completions.ChatCompletionMessageParam[],
        ...(useTools ? { tools: toolDefinitions, tool_choice: "auto" } : {}),
        max_tokens: 1024,
        temperature: 0.3,
      });
    } catch (groqErr: unknown) {
      const msg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      const isToolFailed = msg.includes("tool_use_failed");
      console.error(`Groq error (iter ${i}):`, msg);
      if (isToolFailed && toolRetries < 2) {
        // Groq gagal generate tool call — coba ulang dengan tools aktif dulu
        toolRetries++;
        continue;
      }
      if (isToolFailed && !disableTools) {
        disableTools = true; // terakhir: jawab tanpa tools
        continue;
      }
      finalResponse = "Maaf kak, ada gangguan sesaat. Bisa coba tanya lagi?";
      break;
    }

    if (!response) continue;
    const choice = response.choices[0];

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: choice.message.content ?? "",
        tool_calls: choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
      currentMessages.push(assistantMsg);

      for (const toolCall of choice.message.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch { args = {}; }

        console.log(`🔧 Tool: ${toolCall.function.name}`, args);
        if (toolCall.function.name === "generatePayment") paymentGenerated = true;
        const result = await executeTool(toolCall.function.name, args, toolCtx);
        console.log(`✅ Result:`, result);

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
          name: toolCall.function.name,
        });
      }
      continue;
    }

    finalResponse = choice.message.content ?? "Maaf, terjadi kesalahan.";
    // Bersihkan sisa tool-call syntax yang kadang bocor ke output model kecil
    finalResponse = finalResponse
      .replace(/<function[^>]*>[\s\S]*?<\/function>/gi, "")
      .replace(/```json[\s\S]*?```/g, "")
      .replace(/\{"name":\s*"[^"]+",\s*"parameters"[\s\S]*?\}/g, "")
      .trim();
    // Guard: output model melantur / bocor reasoning
    if (finalResponse.length > 1500 || /\bWe need to\b/.test(finalResponse)) {
      console.warn("⚠️  Output model tidak wajar, diganti fallback");
      finalResponse = "Maaf kak, aku kurang jelas. Bisa diulang pesannya?";
    }
    if (!finalResponse) finalResponse = "Maaf, terjadi kesalahan.";
    break;
  }

  if (!finalResponse) finalResponse = "Maaf, terjadi kesalahan. Coba lagi ya kak.";

  // 7. Simpan seluruh history ke context store
  await saveHistory(tenantId, waNumber, [
    ...currentMessages,
    { role: "assistant", content: finalResponse },
  ]);

  // 8. Simpan balasan AI ke DB
  await supabase.from("messages").insert({
    conversationId,
    role: "AI",
    content: finalResponse,
  });

  return { text: finalResponse, sendQris: paymentGenerated };
}
