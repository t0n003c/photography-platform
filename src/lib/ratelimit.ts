import { getRedis } from "@/src/redis/client";

// Redis fixed-window rate limiter (API-DESIGN §5). Shared across instances,
// survives restarts. Returns headers to attach on throttle.
export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfter: number; // seconds
  headers: Record<string, string>;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const k = `rl:${key}`;
  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, windowSec);
  let ttl = await redis.ttl(k);
  if (ttl < 0) ttl = windowSec;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  return {
    ok: allowed,
    limit,
    remaining,
    retryAfter: allowed ? 0 : Math.max(1, ttl),
    headers: {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + ttl),
    },
  };
}
