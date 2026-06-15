import IORedis, { type Redis } from "ioredis";
import { getEnv } from "@/src/lib/env";

// Connection OPTIONS for BullMQ (queue + worker). Passing a plain options object
// (rather than a shared IORedis instance) lets BullMQ own its connection and
// avoids type skew between the top-level ioredis and the copy bundled by bullmq.
// `maxRetriesPerRequest: null` is required by BullMQ.
export function getBullConnection() {
  const url = new URL(getEnv().REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

let appRedis: Redis | null = null;
let loggedRedisError = false;

// Shared connection for app-level use (cache, rate-limit) — NOT for BullMQ.
// Lazy-connect + an error handler so a missing Redis (e.g. at build time) never
// emits an unhandled error; callers (the cache layer, rate limiter) handle
// failures gracefully.
export function getRedis(): Redis {
  if (!appRedis) {
    appRedis = new IORedis(getEnv().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    appRedis.on("error", (err: Error) => {
      if (!loggedRedisError) {
        loggedRedisError = true;
        console.warn("[redis] connection error:", err.message);
      }
    });
  }
  return appRedis;
}
