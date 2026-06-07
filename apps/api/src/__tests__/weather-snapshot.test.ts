import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { scenarios } from "@reissulla/test-fixtures";
import type { FastifyInstance } from "fastify";

const { HELSINKI_COORD } = scenarios;

const LAT = HELSINKI_COORD.lat.toFixed(2);
const LON = HELSINKI_COORD.lon.toFixed(2);

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

async function clearSnapshotCaches(): Promise<void> {
  await Promise.all([
    cacheDel(`weather:current:v1:${LAT}:${LON}`),
    cacheDel(`weather:forecast:v1:${LAT}:${LON}`),
    cacheDel(`weather:aq:v1:${LAT}:${LON}`),
    cacheDel(`weather:warnings:v2::fi`),
    cacheDel(`weather:warnings:v2::en`),
    cacheDel(`weather:roads:v1:${LAT}:${LON}`),
    cacheDel(`weather:nowcast:v1:${LAT}:${LON}`),
  ]);
}

describe("GET /api/v1/weather/snapshot", () => {
  beforeEach(clearSnapshotCaches);

  it("returns the full snapshot for Helsinki", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/snapshot?lat=${LAT}&lon=${LON}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.current.temperature).toBe(15.2);
    expect(body.data.forecast.hourly.length).toBeGreaterThan(0);
    expect(body.data.airQuality.europeanAqi).toBe(32);
    expect(body.data.pollen.birch).toBe(2.1);
    expect(body.data.roadConditions.sectionName).toBe("Helsinki keskusta");
    // The Open-Meteo fixture's hourly (clear-sky code 2, low precip probs)
    // resolves to no-rain via the radar-chunk nowcast.
    expect(body.data.nowcast).not.toBeNull();
    expect(body.data.nowcast.state).toBe("no-rain");
    expect(body.locale).toBe("fi");
  });

  it("intersects FMI warning polygons against the requested coordinate", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/snapshot?lat=${LAT}&lon=${LON}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data.warnings)).toBe(true);
    expect(body.data.warnings.length).toBe(1);
    expect(body.data.warnings[0].region).toBe("FI:Uusimaa");
    expect(body.data.warnings[0].type).toBe("wind");
  });

  it("excludes warning polygons that don't cover the requested point", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/snapshot?lat=63.5&lon=24.5",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.warnings.length).toBe(0);
  });

  it("picks up locale from Accept-Language for anonymous requests", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/snapshot?lat=${LAT}&lon=${LON}`,
      headers: { "accept-language": "en-US,en;q=0.9" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().locale).toBe("en");
  });

  it("serves cached pieces on the second call (meta.cached === true)", async () => {
    await server.inject({
      method: "GET",
      url: `/api/v1/weather/snapshot?lat=${LAT}&lon=${LON}`,
    });
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/snapshot?lat=${LAT}&lon=${LON}`,
    });
    expect(res.statusCode).toBe(200);
    const meta = res.json().meta;
    expect(meta.current.cached).toBe(true);
    expect(meta.forecast.cached).toBe(true);
    expect(meta.airQuality.cached).toBe(true);
    expect(meta.warnings.cached).toBe(true);
    expect(meta.roadConditions.cached).toBe(true);
  });

  it("rejects coordinates that fail validation", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/snapshot?lat=91&lon=24",
    });
    expect(res.statusCode).toBe(400);
  });
});
