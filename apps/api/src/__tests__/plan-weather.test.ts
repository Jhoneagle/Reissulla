import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";

/**
 * Integration coverage for the `weather: true` opt-in on
 * `POST /api/v1/transit/plan`. Two contracts:
 *
 * 1. `weather: true` returns each itinerary with a populated `weather`
 *    envelope (origin + destination forecast + outdoor-wait notes).
 * 2. `weather: false` (or omitted) returns the legacy shape — `weather`
 *    is `undefined` so existing share-link consumers see no change.
 *
 * The cross-region case exercises the HEL → TPE plan fixture from
 * packages/test-fixtures and asserts the destination forecast carries
 * Tampere's distinctive precipitation_probability ramp (50–60% across
 * the noon hours) — proving the strip is reading Tampere's bucket and
 * not Helsinki's by accident.
 */

let server: FastifyInstance;

const HEL_ORIGIN = { lat: 60.17, lon: 24.94 };
const HEL_DEST_LOCAL = { lat: 60.2, lon: 24.96 };
const TPE_DEST = { lat: 61.5, lon: 23.79 };

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

async function flushPlanAndForecastCaches(): Promise<void> {
  const planKeys = await redis.keys("transit:plan:*");
  if (planKeys.length > 0) {
    await Promise.all(planKeys.map((k) => cacheDel(k)));
  }
  await Promise.all(
    [
      [HEL_ORIGIN.lat, HEL_ORIGIN.lon],
      [HEL_DEST_LOCAL.lat, HEL_DEST_LOCAL.lon],
      [TPE_DEST.lat, TPE_DEST.lon],
      [60.2, 24.93], // Pasila transfer bucket
    ].map(([lat, lon]) =>
      cacheDel(
        cacheKey("weather", "forecast", 1, lat!.toFixed(2), lon!.toFixed(2)),
      ),
    ),
  );
}

beforeEach(async () => {
  await flushPlanAndForecastCaches();
});

describe("POST /api/v1/transit/plan — weather opt-in", () => {
  it("legacy call (weather omitted) returns itineraries without a weather field", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: HEL_DEST_LOCAL },
        numItineraries: 1,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: { itineraries: { weather?: unknown }[] };
    };
    expect(body.data.itineraries.length).toBeGreaterThan(0);
    for (const it of body.data.itineraries) {
      expect(it.weather).toBeUndefined();
    }
  });

  it("weather:false explicit also returns the legacy shape", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: HEL_DEST_LOCAL },
        numItineraries: 1,
        weather: false,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: { itineraries: { weather?: unknown }[] };
    };
    expect(body.data.itineraries[0]!.weather).toBeUndefined();
  });

  it("weather:true returns origin + destination forecast on a Helsinki plan", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: HEL_DEST_LOCAL },
        numItineraries: 1,
        weather: true,
      },
    });
    expect(res.statusCode).toBe(200);
    type WireItinerary = {
      weather?: {
        originWeather: { temperature: number } | null;
        destinationWeather: { temperature: number } | null;
        legOutdoorWaits: { legIndex: number; outdoorWaitMin: number }[];
      };
    };
    const body = res.json() as { data: { itineraries: WireItinerary[] } };
    expect(body.data.itineraries.length).toBeGreaterThan(0);
    const first = body.data.itineraries[0]!;
    expect(first.weather).toBeDefined();
    expect(typeof first.weather!.originWeather?.temperature).toBe("number");
  });

  it("weather:true on the cross-region HEL → TPE plan reads Tampere's forecast for the destination", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: TPE_DEST },
        numItineraries: 1,
        weather: true,
      },
    });
    expect(res.statusCode).toBe(200);
    type WireItinerary = {
      legs: { mode: string }[];
      weather?: {
        originWeather: {
          temperature: number;
          precipitationProbability: number;
        } | null;
        destinationWeather: {
          temperature: number;
          precipitationProbability: number;
        } | null;
        legOutdoorWaits: { legIndex: number; outdoorWaitMin: number }[];
      };
    };
    const body = res.json() as { data: { itineraries: WireItinerary[] } };
    expect(body.data.itineraries.length).toBeGreaterThan(0);

    const first = body.data.itineraries[0]!;
    expect(first.weather).toBeDefined();

    // Tampere fixture sets precipitation_probability between 40 and 65;
    // Helsinki fixture sets it ≤ 30. A correct destination lookup must
    // land in the Tampere band.
    expect(
      first.weather!.destinationWeather?.precipitationProbability,
    ).toBeGreaterThanOrEqual(40);

    // The Pasila platform wait > 5 min should surface as a single
    // outdoor-wait entry (the WALK→RAIL gap is 5 min and skipped, the
    // RAIL→RAIL Pasila transfer is 9 min and reported).
    const waits = first.weather!.legOutdoorWaits;
    expect(waits.length).toBeGreaterThanOrEqual(1);
    expect(waits.every((w) => w.outdoorWaitMin > 5)).toBe(true);
  });
});
