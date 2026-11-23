import type Groq from "groq-sdk";
import { cariProduk, cekStok } from "./products";
import { simpanDataCustomer } from "./customers";
import { buatOrder, cekStatusOrder } from "./orders";
import { generatePayment } from "./payments";

// ── Tool definitions untuk Groq function calling ──────────────────────────────

export const toolDefinitions: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "cariProduk",
      description: "Cari produk berdasarkan nama atau kategori. Gunakan saat customer tanya ada produk apa.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nama produk atau kategori yang dicari" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cekStok",
      description: "Cek ketersediaan stok dan harga produk berdasarkan ID produk.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "ID produk yang ingin dicek" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simpanDataCustomer",
      description: "Simpan data diri customer (nama, alamat, catatan) sebelum membuat order.",
      parameters: {
        type: "object",
        properties: {
          nama: { type: "string", description: "Nama lengkap customer" },
          alamat: { type: "string", description: "Alamat pengiriman" },
          catatan: { type: "string", description: "Catatan tambahan dari customer" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buatOrder",
      description:
        "Buat pesanan baru setelah customer konfirmasi. Selalu minta konfirmasi dulu sebelum memanggil fungsi ini.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Daftar item yang dipesan",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                qty: { type: "number" },
              },
              required: ["productId", "qty"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generatePayment",
      description: "Generate link atau QRIS pembayaran setelah order dibuat.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "ID order yang sudah dibuat" },
          method: {
            type: "string",
            enum: ["qris", "marketplace", "web"],
          },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cekStatusOrder",
      description: "Cek status pesanan customer berdasarkan order ID.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
        },
        required: ["orderId"],
      },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

interface ToolContext {
  tenantId: string;
  customerId: string;
  waNumber: string;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case "cariProduk":
      return cariProduk(ctx.tenantId, args.query as string);

    case "cekStok":
      return cekStok(ctx.tenantId, args.productId as string);

    case "simpanDataCustomer":
      return simpanDataCustomer(ctx.tenantId, ctx.waNumber, {
        nama: args.nama as string | undefined,
        alamat: args.alamat as string | undefined,
        catatan: args.catatan as string | undefined,
      });

    case "buatOrder":
      return buatOrder(
        ctx.tenantId,
        ctx.customerId,
        args.items as Array<{ productId: string; qty: number }>,
        (args.checkoutMethod as string) ?? "qris"
      );

    case "generatePayment":
      return generatePayment(
        ctx.tenantId,
        args.orderId as string,
        (args.method as "qris" | "marketplace" | "web") ?? "qris"
      );

    case "cekStatusOrder":
      return cekStatusOrder(ctx.tenantId, args.orderId as string);

    default:
      return { error: `Tool '${name}' tidak dikenal` };
  }
}
