import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

async function clearWarningCaches(): Promise<void> {
  await Promise.all([
    cacheDel("weather:warnings:v2::fi"),
    cacheDel("weather:warnings:v2::en"),
  ]);
}

describe("GET /api/v1/weather/warning-polygons", () => {
  beforeEach(clearWarningCaches);

  it("returns the full national warning set, not just point-intersecting ones", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/warning-polygons",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data.polygons)).toBe(true);
    expect(body.data.polygons.length).toBeGreaterThan(0);
    // Each polygon carries the bounds + metadata the FE needs to render.
    const sample = body.data.polygons[0];
    expect(sample.id).toBeDefined();
    expect(sample.severity).toBeDefined();
    expect(sample.bounds.type).toBe("Polygon");
    expect(sample.meta).toBeUndefined();
  });

  it("reports cached=true on the second call within the TTL window", async () => {
    const first = await server.inject({
      method: "GET",
      url: "/api/v1/weather/warning-polygons",
    });
    expect(first.json().meta.cached).toBe(false);

    const second = await server.inject({
      method: "GET",
      url: "/api/v1/weather/warning-polygons",
    });
    expect(second.json().meta.cached).toBe(true);
  });

  it("respects an explicit region parameter", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/warning-polygons?region=FI:Uusimaa",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.region).toBe("FI:Uusimaa");
  });
});
