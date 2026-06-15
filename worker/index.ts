import http from "node:http";
import { Worker } from "bullmq";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getBullConnection } from "@/src/redis/client";
import { getEnv } from "@/src/lib/env";
import { db } from "@/src/db/client";
import { IMAGE_QUEUE, type ProcessImageJob } from "@/src/queue/jobs/image";
import { EMAIL_QUEUE, type SendEmailJob } from "@/src/queue/jobs/email";
import { processImage } from "@/src/image/pipeline";
import { getEmailProvider } from "@/src/email";

// The worker runs the sharp → derivatives → LQIP → storage → DB pipeline and,
// on boot, applies DB migrations so `docker compose up` is self-contained.
async function bootstrap() {
  if (process.env.RUN_MIGRATIONS !== "false") {
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    console.log("[worker] migrations up to date");
  }

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

  worker.on("ready", () =>
    console.log(`[worker] listening on queue "${IMAGE_QUEUE}"`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[worker] job ${job?.id} failed:`, err.message),
  );

  // Email consumer — sends via the configured EmailProvider (log by default).
  const emailWorker = new Worker<SendEmailJob>(
    EMAIL_QUEUE,
    async (job) => {
      await getEmailProvider().send(job.data.message);
      return { ok: true };
    },
    { connection: getBullConnection(), concurrency: 4 },
  );
  emailWorker.on("ready", () =>
    console.log(`[worker] listening on queue "${EMAIL_QUEUE}"`),
  );
  emailWorker.on("failed", (job, err) =>
    console.error(`[worker] email job ${job?.id} failed:`, err.message),
  );

  // Liveness endpoint for the compose healthcheck (worker has no HTTP surface).
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

  async function shutdown(signal: string) {
    console.log(`[worker] ${signal} received, closing…`);
    await Promise.all([worker.close(), emailWorker.close()]);
    process.exit(0);
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[worker] fatal startup error", err);
  process.exit(1);
});
