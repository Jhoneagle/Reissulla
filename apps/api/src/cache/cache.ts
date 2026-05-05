import { redis } from "./redis.js";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (data === null) return null;
  return JSON.parse(data) as T;
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
