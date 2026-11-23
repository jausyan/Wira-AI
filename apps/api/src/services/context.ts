/**
 * Conversation context manager.
 * Pakai Redis jika REDIS_URL tersedia, fallback ke in-memory Map untuk dev.
 */
import { config } from "../config";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  name?: string;
}

const TTL_SECONDS = 60 * 60 * 24; // 24 jam
const memoryStore = new Map<string, { data: ChatMessage[]; expiry: number }>();

// ── Redis client (lazy init) ──────────────────────────────────────────────────
let redisClient: import("ioredis").Redis | null = null;

async function getRedis() {
  if (!config.REDIS_URL) return null;
  if (redisClient) return redisClient;

  const { Redis } = await import("ioredis");
  redisClient = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redisClient.on("error", (err) => {
    console.warn("⚠️  Redis error, fallback ke in-memory:", err.message);
    redisClient = null;
  });

  await redisClient.connect().catch(() => {
    redisClient = null;
  });

  return redisClient;
}

function buildKey(tenantId: string, waNumber: string) {
  return `wira:ctx:${tenantId}:${waNumber}`;
}

export async function getHistory(tenantId: string, waNumber: string): Promise<ChatMessage[]> {
  const key = buildKey(tenantId, waNumber);
  const redis = await getRedis();

  if (redis) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : [];
  }

  // In-memory fallback
  const entry = memoryStore.get(key);
  if (!entry || Date.now() > entry.expiry) return [];
  return entry.data;
}

export async function saveHistory(
  tenantId: string,
  waNumber: string,
  messages: ChatMessage[]
) {
  const key = buildKey(tenantId, waNumber);
  // Simpan max 30 pesan terakhir agar token tidak membengkak
  const trimmed = messages.slice(-30);
  const redis = await getRedis();

  if (redis) {
    await redis.set(key, JSON.stringify(trimmed), "EX", TTL_SECONDS);
    return;
  }

  memoryStore.set(key, { data: trimmed, expiry: Date.now() + TTL_SECONDS * 1000 });
}

export async function clearHistory(tenantId: string, waNumber: string) {
  const key = buildKey(tenantId, waNumber);
  const redis = await getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  memoryStore.delete(key);
}
