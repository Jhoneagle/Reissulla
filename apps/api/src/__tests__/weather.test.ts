import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { WMO_CODES } from "@reissulla/shared";
import type { FastifyInstance } from "fastify";

const HELSINKI_LAT = "60.17";
const HELSINKI_LON = "24.94";

const mockCurrentResponse = {
  latitude: 60.17,
  longitude: 24.94,
  current: {
    time: "2026-05-05T12:00",
    temperature_2m: 15.2,
    apparent_temperature: 13.1,
    relative_humidity_2m: 65,
    wind_speed_10m: 5.4,
    wind_direction_10m: 220,
    weather_code: 2,
    is_day: 1,
  },
};

const mockForecastResponse = {
  latitude: 60.17,
  longitude: 24.94,
  hourly: {
    time: ["2026-05-05T12:00", "2026-05-05T13:00"],
    temperature_2m: [15.2, 16.0],
    relative_humidity_2m: [65, 60],
    precipitation_probability: [10, 20],
    weather_code: [2, 3],
    wind_speed_10m: [5.4, 6.1],
  },
  daily: {
    time: ["2026-05-05"],
    temperature_2m_max: [18.0],
    temperature_2m_min: [8.5],
    precipitation_probability_max: [30],
    weather_code: [2],
    sunrise: ["2026-05-05T04:45"],
    sunset: ["2026-05-05T21:30"],
  },
};

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
    await cacheDel("weather:current:v1:60.17:24.94");
    vi.restoreAllMocks();
  });

  it("returns current weather for Helsinki", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockCurrentResponse), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    const c = mockCurrentResponse.current;
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.temperature).toBe(c.temperature_2m);
    expect(body.data.weatherDescription).toBe(WMO_CODES[c.weather_code]);
    expect(body.data.isDay).toBe(c.is_day === 1);
    expect(body.coordinates.latitude).toBe(mockCurrentResponse.latitude);
    expect(body.cached).toBe(false);
  });

  it("serves cached response on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockCurrentResponse), { status: 200 }),
      );

    // First call — hits API
    await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call — should hit cache
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1); // no additional fetch
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.temperature).toBe(
      mockCurrentResponse.current.temperature_2m,
    );
    expect(body.cached).toBe(true);
  });

  it("returns 502 when Open-Meteo is down", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/current?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error.code).toBe("WEATHER_UNAVAILABLE");
  });
});

describe("GET /api/v1/weather/forecast", () => {
  beforeEach(async () => {
    await cacheDel("weather:forecast:v1:60.17:24.94");
    vi.restoreAllMocks();
  });

  it("returns forecast for Helsinki", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockForecastResponse), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    const h = mockForecastResponse.hourly;
    const d = mockForecastResponse.daily;
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.hourly).toHaveLength(h.time.length);
    expect(body.data.daily).toHaveLength(d.time.length);
    expect(body.data.hourly[0].temperature).toBe(h.temperature_2m[0]);
    expect(body.data.daily[0].temperatureMax).toBe(d.temperature_2m_max[0]);
    expect(body.data.daily[0].sunrise).toBe(d.sunrise[0]);
  });

  it("serves cached forecast on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockForecastResponse), { status: 200 }),
      );

    await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Open-Meteo is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/weather/forecast?lat=${HELSINKI_LAT}&lon=${HELSINKI_LON}`,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("WEATHER_UNAVAILABLE");
  });
});
