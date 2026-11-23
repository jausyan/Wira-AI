import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { z } from "zod";

const env = z.object({
  PORT: z.string().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GROQ_API: z.string({ required_error: "GROQ_API wajib diisi" }),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  SUPABASE_URL: z.string({ required_error: "SUPABASE_URL wajib diisi" }),
  SUPABASE_ANON_KEY: z.string({ required_error: "SUPABASE_ANON_KEY wajib diisi" }),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  // OpenWA
  OPENWA_URL: z.string().default("http://localhost:2785/api"),
  OPENWA_API_KEY: z.string({ required_error: "OPENWA_API_KEY wajib diisi" }),
  OPENWA_SESSION_ID: z.string({ required_error: "OPENWA_SESSION_ID wajib diisi" }),
  // Midtrans (Phase 2)
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z.string().default("false"),
});

const parsed = env.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Environment variable tidak lengkap:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
