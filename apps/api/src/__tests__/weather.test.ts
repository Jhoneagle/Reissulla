import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { WMO_CODES } from "@reissulla/shared";
import { scenarios } from "@reissulla/test-fixtures";
import type { FastifyInstance } from "fastify";

const { HELSINKI_COORD, WEATHER_ERROR_COORD, WEATHER_NETWORK_ERROR_COORD } =
  scenarios;

const HELSINKI_LAT = HELSINKI_COORD.lat.toFixed(2);
const HELSINKI_LON = HELSINKI_COORD.lon.toFixed(2);

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

describe("Weather routes - input validation", () => {
  it("returns 400 when lat/lon are missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/current",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when lat is out of range", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/current?lat=91&lon=24",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when lon is out of range", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/current?lat=60&lon=181",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for non-numeric coordinates", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/current?lat=abc&lon=24",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for empty string coordinates", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/weather/current?lat=&lon=",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/weather/current", () => {
  beforeEach(async () => {
    await cacheDel(`weather:current:v1:${HELSINKI_LAT}:${HELSINKI_LON}`);
    await cacheDel(
      `weather:current:v1:${WEATHER_ERROR_COORD.lat.toFixed(2)}:${WEATHER_ERROR_COORD.lon.toFixed(2)}`,
    );
  });

  it("returns current weather for Helsinki", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.temperature).toBe(15.2);
    expect(body.data.weatherDescription).toBe(WMO_CODES[2]);
    expect(body.data.isDay).toBe(true);
    expect(body.coordinates.latitude).toBe(HELSINKI_COORD.lat);
    expect(body.cached).toBe(false);
  });

  it("serves cached response on second call", async () => {
    // First call — hits MSW upstream and caches.
    const first = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().cached).toBe(false);

    // Second call — served from Redis.
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Open-Meteo is down", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${WEATHER_ERROR_COORD.lat}&lon=${WEATHER_ERROR_COORD.lon}`,
    });

    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error.code).toBe("WEATHER_UNAVAILABLE");
  });
});

describe("GET /api/v1/weather/forecast", () => {
  beforeEach(async () => {
    await cacheDel(`weather:forecast:v1:${HELSINKI_LAT}:${HELSINKI_LON}`);
    await cacheDel(
      `weather:forecast:v1:${WEATHER_NETWORK_ERROR_COORD.lat.toFixed(2)}:${WEATHER_NETWORK_ERROR_COORD.lon.toFixed(2)}`,
    );
  });

  it("returns forecast for Helsinki", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.hourly.length).toBeGreaterThan(0);
    expect(body.data.daily).toHaveLength(1);
    // Hourly fixture spans 09:00–16:00 Helsinki; the 12:00 entry carries
    // the canonical temperature/precipitation values the rest of the
    // suite anchors on.
    const noonHour = body.data.hourly.find(
      (h: { time: string }) => h.time === "2026-05-05T12:00",
    );
    expect(noonHour?.temperature).toBe(15.2);
    expect(body.data.daily[0].temperatureMax).toBe(18.0);
    expect(body.data.daily[0].sunrise).toBe("2026-05-05T04:45");
  });

  it("serves cached forecast on second call", async () => {
    const first = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });
    expect(first.json().cached).toBe(false);

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Open-Meteo is down", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${WEATHER_NETWORK_ERROR_COORD.lat}&lon=${WEATHER_NETWORK_ERROR_COORD.lon}`,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("WEATHER_UNAVAILABLE");
  });
});
