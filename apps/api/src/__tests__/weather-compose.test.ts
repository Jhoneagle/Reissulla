import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { scenarios } from "@reissulla/test-fixtures";
import { getWeatherSnapshot } from "../services/weather/composition.service.js";

const { HELSINKI_COORD, WEATHER_ERROR_COORD, WEATHER_NETWORK_ERROR_COORD } =
  scenarios;

beforeAll(async () => {
  await redis.connect();
});

afterAll(async () => {
  await redis.quit();
});

async function clearAllSnapshotCaches(lat: number, lon: number): Promise<void> {
  const latKey = lat.toFixed(2);
  const lonKey = lon.toFixed(2);
  await Promise.all([
    cacheDel(`weather:current:v1:${latKey}:${lonKey}`),
    cacheDel(`weather:forecast:v1:${latKey}:${lonKey}`),
    cacheDel(`weather:aq:v1:${latKey}:${lonKey}`),
    cacheDel(`weather:roads:v1:${latKey}:${lonKey}`),
    cacheDel(`weather:nowcast:v1:${latKey}:${lonKey}`),
    cacheDel(`weather:warnings:v2::fi`),
    cacheDel(`weather:warnings:v2::en`),
  ]);
}

describe("getWeatherSnapshot — partial failures", () => {
  beforeEach(async () => {
    await Promise.all([
      clearAllSnapshotCaches(HELSINKI_COORD.lat, HELSINKI_COORD.lon),
      clearAllSnapshotCaches(WEATHER_ERROR_COORD.lat, WEATHER_ERROR_COORD.lon),
      clearAllSnapshotCaches(
        WEATHER_NETWORK_ERROR_COORD.lat,
        WEATHER_NETWORK_ERROR_COORD.lon,
      ),
    ]);
  });

  it("returns the full set when every upstream is healthy", async () => {
    const { data, meta } = await getWeatherSnapshot(
      HELSINKI_COORD.lat,
      HELSINKI_COORD.lon,
      { locale: "fi" },
    );

    expect(data.current).not.toBeNull();
    expect(data.forecast).not.toBeNull();
    expect(data.airQuality).not.toBeNull();
    expect(data.pollen).not.toBeNull();
    expect(data.roadConditions).not.toBeNull();
    expect(meta.current.failed).toBe(false);
    expect(meta.airQuality.failed).toBe(false);
    expect(meta.warnings.failed).toBe(false);
    expect(meta.roadConditions.failed).toBe(false);
  });

  it("returns partial data when Open-Meteo current weather is down (503)", async () => {
    const { data, meta } = await getWeatherSnapshot(
      WEATHER_ERROR_COORD.lat,
      WEATHER_ERROR_COORD.lon,
      { locale: "fi" },
    );

    expect(data.current).toBeNull();
    expect(meta.current.failed).toBe(true);
    expect(meta.forecast.failed).toBe(true);
    expect(meta.airQuality.failed).toBe(true);
    // FMI and Fintraffic are independent fan-outs — they should still resolve.
    expect(meta.warnings.failed).toBe(false);
    expect(meta.roadConditions.failed).toBe(false);
  });

  it("returns partial data on network failures (fetch reject)", async () => {
    const { data, meta } = await getWeatherSnapshot(
      WEATHER_NETWORK_ERROR_COORD.lat,
      WEATHER_NETWORK_ERROR_COORD.lon,
      { locale: "fi" },
    );

    expect(data.current).toBeNull();
    expect(meta.current.failed).toBe(true);
    expect(meta.warnings.failed).toBe(false);
  });

  it("keys warnings cache by locale so fi + en bypass each other", async () => {
    const first = await getWeatherSnapshot(
      HELSINKI_COORD.lat,
      HELSINKI_COORD.lon,
      { locale: "fi" },
    );
    expect(first.meta.warnings.cached).toBe(false);

    const second = await getWeatherSnapshot(
      HELSINKI_COORD.lat,
      HELSINKI_COORD.lon,
      { locale: "fi" },
    );
    expect(second.meta.warnings.cached).toBe(true);

    // Different locale → fresh cache miss.
    const third = await getWeatherSnapshot(
      HELSINKI_COORD.lat,
      HELSINKI_COORD.lon,
      { locale: "en" },
    );
    expect(third.meta.warnings.cached).toBe(false);
  });
});
