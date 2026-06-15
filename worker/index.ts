import http from "node:http";
import { Worker } from "bullmq";
import { getBullConnection } from "@/src/redis/client";
import { getEnv } from "@/src/lib/env";
import { IMAGE_QUEUE, type ProcessImageJob } from "@/src/queue/jobs/image";
import { processImage } from "@/src/image/pipeline";

// ── BullMQ consumer ─────────────────────────────────────────────────────────
// Runs the sharp → derivatives → LQIP → storage → DB pipeline. Idempotent on
// the photo id; failures mark the photo `failed` and are retried by BullMQ.
const worker = new Worker<ProcessImageJob>(
  IMAGE_QUEUE,
  async (job) => {
    console.log(`[worker] processing photo ${job.data.photoId}`);
    await processImage(job.data);
    return { ok: true };
  },
  {
    connection: getBullConnection(),
    concurrency: 4,
  },
);

worker.on("ready", () => console.log(`[worker] listening on queue "${IMAGE_QUEUE}"`));
worker.on("failed", (job, err) =>
  console.error(`[worker] job ${job?.id} failed:`, err.message),
);

// ── Liveness endpoint ───────────────────────────────────────────────────────
// The worker has no HTTP surface of its own, so expose a tiny health server
// purely for the compose healthcheck.
const port = getEnv().WORKER_HEALTH_PORT;
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "worker" }));
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(port, () => console.log(`[worker] health server on :${port}`));

// ── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, closing…`);
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
