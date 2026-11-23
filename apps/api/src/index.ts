import "./config"; // validasi env di awal
import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { config } from "./config";
import { healthRoutes } from "./routes/health";
import { webhookRoutes } from "./routes/webhook";
import { initQueue } from "./services/queue";

const app = Fastify({
  logger: {
    transport:
      config.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

async function bootstrap() {
  // Plugins
  await app.register(cors, { origin: true });
  await app.register(formbody);

  // Routes
  await app.register(healthRoutes);
  await app.register(webhookRoutes);

  // Init queue (opsional — hanya jika Redis tersedia)
  await initQueue();

  // Start server
  await app.listen({ port: Number(config.PORT), host: "0.0.0.0" });
  console.log(`\n🚀 Wira AI API berjalan di http://localhost:${config.PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${config.PORT}/webhook/openwa`);
  console.log(`🧪 Test endpoint: POST http://localhost:${config.PORT}/webhook/test\n`);
}

bootstrap().catch((err) => {
  console.error("Bootstrap error:", err);
  process.exit(1);
});
