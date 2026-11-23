/**
 * OpenWA Webhook
 * POST /webhook/openwa  ← daftarkan URL ini di OpenWA dashboard/API
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "@wira/db";
import { normalizeWa } from "../services/whatsapp";
import { enqueueMessage } from "../services/queue";
import { config } from "../config";

const openwaPayload = z.object({
  event: z.string(),
  sessionId: z.string(),
  data: z.object({
    from: z.string(),
    to: z.string(),
    chatId: z.string().optional(),
    body: z.string().optional().default(""),
    type: z.string().default("text"),
    isGroup: z.boolean().default(false),
    fromMe: z.boolean().optional(),
    senderPhone: z.string().optional().nullable(), // dari RESOLVE_LID_TO_PHONE
    contact: z.object({
      name: z.string().optional(),
      pushName: z.string().optional(),
    }).optional(),
  }),
});

export async function webhookRoutes(app: FastifyInstance) {
  // GET untuk verifikasi webhook
  app.get("/webhook/openwa", async (_req, reply) => {
    return reply.status(200).send({ ok: true, service: "Wira AI" });
  });

  app.post("/webhook/openwa", async (req, reply) => {
    const raw = req.body as Record<string, unknown>;
    // Hanya proses event message.received
    if (raw?.event !== "message.received") {
      return reply.status(200).send({ ok: true, skipped: raw?.event });
    }

    let body: z.infer<typeof openwaPayload>;
    try {
      body = openwaPayload.parse(req.body);
    } catch {
      app.log.warn({ body: req.body }, "Invalid OpenWA payload");
      return reply.status(200).send({ ok: true, skipped: "parse_error" });
    }

    const { data } = body;

    // Skip pesan dari diri sendiri atau grup
    // Baileys: fromMe eksplisit, fallback ke perbandingan from===to
    const fromMe = data.fromMe === true || data.from === data.to;
    if (fromMe || data.isGroup) {
      return reply.status(200).send({ ok: true, skipped: "fromMe_or_group" });
    }

    // Skip non-teks
    if (!["text", "chat", "extendedText"].includes(data.type)) {
      return reply.status(200).send({ ok: true, skipped: `type:${data.type}` });
    }

    // Skip jika body kosong (notifikasi sistem)
    if (!data.body || data.body.trim() === "") {
      return reply.status(200).send({ ok: true, skipped: "empty_body" });
    }

    // data.to = nomor WA bisnis → cari tenant
    const businessWa = normalizeWa(data.to);

    // Untuk customer: gunakan senderPhone jika ada (resolved dari @lid), fallback ke chatId/from
    const rawCustomer = data.senderPhone ?? data.chatId ?? data.from;
    const customerWa = rawCustomer.includes("@lid")
      ? rawCustomer                    // simpan as-is, dipakai sebagai chatId saat reply
      : normalizeWa(rawCustomer);
    const customerName = data.contact?.pushName ?? data.contact?.name;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, status")
      .eq("waNumber", businessWa)
      .maybeSingle();

    if (!tenant) {
      app.log.warn(`Tenant tidak ditemukan untuk WA: ${businessWa}`);
      return reply.status(200).send({ ok: true, tenant_not_found: true });
    }

    if (tenant.status !== "ACTIVE") {
      return reply.status(200).send({ ok: true, tenant_inactive: true });
    }

    await enqueueMessage({
      tenantId: tenant.id,
      waNumber: customerWa,
      sessionName: config.OPENWA_SESSION_ID,
      customerName,
      message: data.body,
    });

    return reply.status(200).send({ ok: true });
  });

  // Test endpoint — dev only
  app.post("/webhook/test", async (req, reply) => {
    if (config.NODE_ENV === "production") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const { tenantId, waNumber, sessionName, message } = req.body as {
      tenantId?: string;
      waNumber?: string;
      sessionName?: string;
      message?: string;
    };

    if (!tenantId || !waNumber || !message) {
      return reply.status(400).send({ error: "tenantId, waNumber, message wajib diisi" });
    }

    const { runAgent } = await import("../services/agent");
    const result = await runAgent({
      tenantId,
      waNumber,
      sessionName: sessionName ?? waNumber,
      message,
    });
    return { reply: result.text, sendQris: result.sendQris };
  });
}
