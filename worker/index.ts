import http from "node:http";
import { Worker } from "bullmq";
import { getBullConnection } from "@/src/redis/client";
import { getEnv } from "@/src/lib/env";
import { IMAGE_QUEUE, type ProcessImageJob } from "@/src/queue/jobs/image";

// ── BullMQ consumer ─────────────────────────────────────────────────────────
// Phase 1: the handler is a no-op that logs. Phase 2 plugs in the real
// sharp → derivatives → LQIP → storage → DB pipeline (src/image, src/storage).
const worker = new Worker<ProcessImageJob>(
  IMAGE_QUEUE,
  async (job) => {
    console.log(`[worker] received ${job.name} for photo ${job.data.photoId}`);
    // TODO(Phase 2): generate variants + LQIP, persist via StorageProvider,
    // write photo_variants rows, mark photo ready.
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
