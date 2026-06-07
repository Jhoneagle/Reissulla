import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { scenarios } from "@reissulla/test-fixtures";

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

async function clearNowcastCaches(): Promise<void> {
  // The route's per-call cache plus the bucketed radar-tile slot. Match the
  // route's bucket key construction so the test clears the active window
  // and doesn't race the rollover edge.
  await Promise.all([
    cacheDel(`weather:nowcast:v1:${LAT}:${LON}`),
    // Radar timeline buckets the cache key on a 60s window — clear both
    // the current and the previous bucket to avoid edge flakiness.
    ...[0, -1].map((offset) => {
      const bucket = Math.floor(Date.now() / 1000 / 60) * 60 + offset * 60;
      return cacheDel(`weather:radar-tiles:v1:60:${bucket}`);
    }),
  ]);
}

async function clearRadarTileCache(timestamp: number): Promise<void> {
  await cacheDel(`weather:radar-image:v1:${timestamp}:3-4-5`);
}

describe("GET /api/v1/weather/nowcast", () => {
  beforeEach(clearNowcastCaches);

  it("computes a nowcast against the Open-Meteo fixture and returns shape", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/nowcast?lat=${LAT}&lon=${LON}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.cached).toBe(false);
    expect(body.meta.locale).toBe("fi");
    // The fixture's hourly precip probs (10, 20) and clear-sky code (2)
    // produce a no-rain verdict — exact text comes from the formatter.
    expect(body.data).not.toBeNull();
    expect(body.data.state).toBe("no-rain");
    expect(body.data.flavor).toBe("rain");
    expect(body.data.textFi).toBe("Ei sateita näkyvissä.");
    expect(body.data.textEn).toBe("No precipitation expected.");
  });

  it("reports cached=true on the second call within the TTL window", async () => {
    const first = await server.inject({
      method: "GET",
      url: `/api/v1/weather/nowcast?lat=${LAT}&lon=${LON}`,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().meta.cached).toBe(false);

    const second = await server.inject({
      method: "GET",
      url: `/api/v1/weather/nowcast?lat=${LAT}&lon=${LON}`,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().meta.cached).toBe(true);
  });

  it("returns English text when Accept-Language asks for en", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/nowcast?lat=${LAT}&lon=${LON}`,
      headers: { "accept-language": "en" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.locale).toBe("en");
  });
});

describe("GET /api/v1/weather/radar/timeline", () => {
  beforeEach(clearNowcastCaches);

  it("returns the FMI-synthesized 12-frame window for the default 60-min back", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/radar/timeline",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.frames).toHaveLength(12);
    expect(body.data.frames[0].timestamp).toBeLessThan(
      body.data.frames[11].timestamp,
    );
    expect(body.data.frames[0].tileUrlTemplate).toContain("{z}");
    expect(body.data.frames[0].tileUrlTemplate).toContain("{x}");
    expect(body.data.frames[0].tileUrlTemplate).toContain("{y}");
  });

  it("clamps minutesBack into the [5, 120] range", async () => {
    const big = await server.inject({
      method: "GET",
      url: "/api/v1/weather/radar/timeline?minutesBack=9999",
    });
    expect(big.statusCode).toBe(200);
    expect(big.json().meta.minutesBack).toBe(120);

    const tiny = await server.inject({
      method: "GET",
      url: "/api/v1/weather/radar/timeline?minutesBack=0",
    });
    expect(tiny.statusCode).toBe(200);
    expect(tiny.json().meta.minutesBack).toBe(5);
  });
});

describe("GET /api/v1/weather/radar/:ts/:z/:x/:y.png", () => {
  const ts = 1_780_000_000;

  beforeEach(async () => {
    await clearRadarTileCache(ts);
  });

  it("proxies the FMI radar tile bytes with image/png content-type", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/radar/${ts}/3/4/5.png`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toContain("max-age=60");
    // First bytes of a PNG file: 137 80 78 71 ("\x89PNG").
    const buf = Buffer.from(res.rawPayload);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it("returns 400 for non-numeric coordinates", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/radar/abc/3/4/5.png",
    });
    expect(res.statusCode).toBe(400);
  });
});
