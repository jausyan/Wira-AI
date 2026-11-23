import path from "path";
import { config } from "../config";
import { runAgent, type AgentInput } from "./agent";
import { sendMessage, sendImage, sendTyping } from "./whatsapp";

const QRIS_PATH = path.resolve(__dirname, "../../../../payment/qris.jpeg");

let queue: import("bullmq").Queue<AgentInput> | null = null;
let worker: import("bullmq").Worker<AgentInput> | null = null;

async function processMessage(input: AgentInput) {
  await sendTyping(input.sessionName, input.waNumber);
  const result = await runAgent(input);
  console.log(`[queue] reply untuk ${input.waNumber}: "${result.text?.slice(0, 80)}..."`);

  if (!result.text || result.text.trim() === "") {
    console.error("[queue] reply kosong — tidak dikirim");
    return;
  }

  await sendMessage(input.sessionName, input.waNumber, result.text);

  if (result.sendQris) {
    console.log(`[queue] Mengirim QRIS ke ${input.waNumber}`);
    await sendImage(
      input.sessionName,
      input.waNumber,
      QRIS_PATH,
      "Scan QRIS di atas untuk menyelesaikan pembayaran kak 🙏"
    );
  }
}

export async function initQueue() {
  if (!config.REDIS_URL) {
    console.log("ℹ️  REDIS_URL tidak ada — queue disabled, proses pesan langsung");
    return;
  }

  const { Queue, Worker } = await import("bullmq");

  queue = new Queue<AgentInput>("wira-messages", {
    connection: { url: config.REDIS_URL },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  worker = new Worker<AgentInput>(
    "wira-messages",
    async (job) => { await processMessage(job.data); },
    { connection: { url: config.REDIS_URL }, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} gagal:`, err.message);
  });

  console.log("✅ Queue worker aktif (Redis mode)");
}

export async function enqueueMessage(input: AgentInput) {
  if (queue) {
    await queue.add("process", input, { jobId: `${input.tenantId}:${input.waNumber}:${Date.now()}` });
  } else {
    processMessage(input).catch((err) => console.error("processMessage error:", err));
  }
}
