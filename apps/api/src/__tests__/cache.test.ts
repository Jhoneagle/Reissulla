import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "../cache/redis.js";
import { cacheGet, cacheSet, cacheDel } from "../cache/cache.js";

describe("cache utility", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("returns null for a missing key", async () => {
    const result = await cacheGet("nonexistent-key");
    expect(result).toBeNull();
  });

  it("stores and retrieves a value", async () => {
    await cacheSet("test-key", { temp: 22 }, 60);
    const result = await cacheGet<{ temp: number }>("test-key");
    expect(result).toEqual({ temp: 22 });

    await cacheDel("test-key");
  });

  it("respects TTL expiration", async () => {
    await cacheSet("ttl-key", "expires-fast", 1);
    const before = await cacheGet("ttl-key");
    expect(before).toBe("expires-fast");

    await new Promise((r) => setTimeout(r, 1100));
    const after = await cacheGet("ttl-key");
    expect(after).toBeNull();
  });
});
