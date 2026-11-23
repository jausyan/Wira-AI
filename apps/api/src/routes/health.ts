import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "wira-ai-api",
    timestamp: new Date().toISOString(),
  }));

  app.get("/", async () => ({ message: "Wira AI API is running 🚀" }));
}
