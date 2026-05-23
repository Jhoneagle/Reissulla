import { redis } from "./redis.js";

/**
 * Read a value the API previously wrote with cacheSet. Redis is an internal
 * trust boundary — values are produced by this API alone, so the cast to T is
 * a deliberate trust statement, not an unchecked external input. Malformed
 * JSON (e.g. truncated bytes) drops the key and returns null.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (data === null) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    await redis.del(key);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}
