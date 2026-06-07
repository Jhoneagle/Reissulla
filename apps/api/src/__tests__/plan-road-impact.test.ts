import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel, cacheSet } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import type { RoadCondition } from "../adapters/fintraffic/types.js";
import type { FastifyInstance } from "fastify";

/**
 * End-to-end check that planRoute attaches a road-impact penalty to WALK
 * legs when Fintraffic reports a non-dry surface at the leg origin. The
 * upstream condition is seeded directly into the cache so the test does
 * not depend on whatever fixture the global Fintraffic MSW handler ships;
 * the planner reads it via the cache-wrapped helper in
 * `road-impact.service.ts`.
 */

let server: FastifyInstance;

const FROM = { lat: 60.17, lon: 24.94 };
const TO = { lat: 60.2, lon: 24.96 };

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  const keys = await redis.keys("transit:plan:v3:*");
  if (keys.length > 0) await Promise.all(keys.map((k) => cacheDel(k)));
  await cacheDel(
    cacheKey("weather", "roads", 1, FROM.lat.toFixed(2), FROM.lon.toFixed(2)),
  );
});

async function planBody() {
  return server.inject({
    method: "POST",
    url: "/api/v1/transit/plan",
    payload: {
      query: { from: FROM, to: TO },
      numItineraries: 1,
    },
  });
}

describe("planRoute road-impact integration", () => {
  it("attaches baseDuration + roadImpact when the surface is icy", async () => {
    const condition: RoadCondition = {
      sectionId: 9001,
      sectionName: "Test section (icy)",
      surfaceState: "icy",
      weather: "Pakkasta",
      roadTemperature: -4,
      distanceKm: 0.1,
      observedAt: "2026-06-06T08:00:00Z",
    };
    await cacheSet(
      cacheKey("weather", "roads", 1, FROM.lat.toFixed(2), FROM.lon.toFixed(2)),
      condition,
      60,
    );

    const res = await planBody();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const walk = body.data.itineraries[0].legs.find(
      (l: { mode: string }) => l.mode === "WALK",
    );
    expect(walk).toBeDefined();
    expect(walk.roadImpact).toEqual({ reason: "ice", multiplier: 1.15 });
    expect(walk.baseDuration).toBeLessThan(walk.duration);
    expect(walk.duration / walk.baseDuration).toBeCloseTo(1.15, 2);
  });

  it("does not attach roadImpact for dry surfaces", async () => {
    const condition: RoadCondition = {
      sectionId: 9002,
      sectionName: "Test section (dry)",
      surfaceState: "dry",
      weather: "Selkeää",
      roadTemperature: 8,
      distanceKm: 0.1,
      observedAt: "2026-06-06T08:00:00Z",
    };
    await cacheSet(
      cacheKey("weather", "roads", 1, FROM.lat.toFixed(2), FROM.lon.toFixed(2)),
      condition,
      60,
    );

    const res = await planBody();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const walk = body.data.itineraries[0].legs.find(
      (l: { mode: string }) => l.mode === "WALK",
    );
    expect(walk).toBeDefined();
    expect(walk.roadImpact).toBeUndefined();
    expect(walk.baseDuration).toBeUndefined();
  });
});
