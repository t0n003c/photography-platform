import { getRedis } from "@/src/redis/client";

// Tiny Redis query-cache for the hottest PUBLIC read queries. Values are stored
// as JSON, so this is only safe for JSON-serializable data (Date fields become
// strings). The targeted functions return plain string/number fields and string
// dates, which round-trips cleanly. The cache layer never throws: any Redis
// hiccup falls back to computing the value directly.

export const CACHE_KEYS = {
  categories: "pub:categories",
  locations: "pub:locations",
  pageConfig: (scope: string) => `pub:pageconfig:${scope}`,
};

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await getRedis().get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // Redis unavailable — fall through to compute.
    return compute();
  }

  const result = await compute();
  try {
    await getRedis().set(key, JSON.stringify(result), "EX", ttlSeconds);
  } catch {
    // Ignore write failures; the value is still returned.
  }
  return result;
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await getRedis().del(...keys);
  } catch {
    // Ignore — stale entries expire via TTL.
  }
}
