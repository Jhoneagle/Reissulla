import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { TransitItinerary, WeatherForecast } from "@reissulla/shared";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import { attachItineraryWeather } from "../services/transit/trip-weather.service.js";
import * as openMeteoModule from "../adapters/open-meteo-forecast/index.js";

/**
 * Unit coverage for the trip-weather composer. The adapter is spied on
 * directly so the dedup contract — distinct (lat, lon) buckets translate
 * to distinct upstream calls — is asserted on the call count, not via
 * MSW network traffic. The cache is flushed between tests so a previous
 * coord's payload doesn't paper over a missing fetch.
 */

const HEL_ORIGIN = { lat: 60.17, lon: 24.94 };
const HEL_PASILA = { lat: 60.2, lon: 24.93 };
const TPE_DEST = { lat: 61.5, lon: 23.79 };

/**
 * Build a forecast spanning ~6 hours centred on `baseUnixMs`. Time strings
 * mirror open-meteo's `timezone: "auto"` shape — Helsinki-local without a
 * Z suffix — so the composer's helsinkiHourStamp matcher exercises the
 * same parse path as the live adapter.
 */
function buildForecast(
  lat: number,
  lon: number,
  baseUnixMs: number,
): WeatherForecast {
  const HELSINKI_HOUR = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const stampFor = (ms: number) => {
    const parts = HELSINKI_HOUR.formatToParts(new Date(ms));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:00`;
  };
  const baseHourMs = Math.floor(baseUnixMs / 3_600_000) * 3_600_000;
  const offsets = [-1, 0, 1, 2, 3, 4];
  return {
    hourly: offsets.map((o, idx) => ({
      time: stampFor(baseHourMs + o * 3_600_000),
      temperature: lat > 61 ? 8 + idx * 0.2 : 15 + idx * 0.2,
      humidity: 60,
      precipitationProbability: 20,
      weatherCode: 2,
      weatherDescription: "Partly cloudy",
      windSpeed: 4,
    })),
    daily: [],
  };
}

beforeAll(async () => {
  await redis.connect();
});

afterAll(async () => {
  await redis.quit();
});

async function clearForecastCache(lat: number, lon: number): Promise<void> {
  await cacheDel(
    cacheKey("weather", "forecast", 1, lat.toFixed(2), lon.toFixed(2)),
  );
}

beforeEach(async () => {
  await Promise.all([
    clearForecastCache(HEL_ORIGIN.lat, HEL_ORIGIN.lon),
    clearForecastCache(HEL_PASILA.lat, HEL_PASILA.lon),
    clearForecastCache(TPE_DEST.lat, TPE_DEST.lon),
  ]);
  vi.restoreAllMocks();
});

function ctx() {
  return {
    signal: new AbortController().signal,
    locale: "fi" as const,
    persona: undefined,
  };
}

describe("attachItineraryWeather — dedup", () => {
  it("4-leg trip with two legs in the same hour at adjacent coords issues ≤ 2 upstream calls", async () => {
    // Two coord buckets: HEL_ORIGIN (origin + destination collapse to same
    // bucket because the trip is a loop) and HEL_PASILA (transfer point).
    // The wait-bearing legs both start within the same hour at adjacent
    // (but distinct-bucket) coords. Expected: 2 distinct upstream calls.
    const startTime = 1778166000000; // 2026-05-04T08:20:00Z roughly
    const itinerary: TransitItinerary = {
      startTime,
      endTime: startTime + 90 * 60_000,
      duration: 90 * 60,
      walkDistance: 200,
      transfers: 2,
      legs: [
        {
          mode: "WALK",
          startTime,
          endTime: startTime + 5 * 60_000,
          duration: 300,
          distance: 200,
          from: { name: "Origin", ...HEL_ORIGIN },
          to: { name: "Stop A", ...HEL_PASILA },
        },
        {
          mode: "BUS",
          startTime: startTime + 15 * 60_000, // 10 min wait > 5 min — triggers entry
          endTime: startTime + 35 * 60_000,
          duration: 1200,
          distance: 5000,
          from: { name: "Stop A", ...HEL_PASILA },
          to: { name: "Stop B", ...HEL_ORIGIN },
        },
        {
          mode: "TRAM",
          startTime: startTime + 45 * 60_000, // 10 min wait — second entry
          endTime: startTime + 60 * 60_000,
          duration: 900,
          distance: 3000,
          from: { name: "Stop B", ...HEL_ORIGIN },
          to: { name: "Stop C", ...HEL_PASILA },
        },
        {
          mode: "WALK",
          startTime: startTime + 60 * 60_000,
          endTime: startTime + 90 * 60_000,
          duration: 1800,
          distance: 600,
          from: { name: "Stop C", ...HEL_PASILA },
          to: { name: "Destination", ...HEL_ORIGIN },
        },
      ],
    };

    const getForecastSpy = vi
      .spyOn(openMeteoModule.openMeteoForecast, "getForecast")
      .mockImplementation(async (lat, lon) =>
        buildForecast(lat, lon, startTime),
      );

    const [result] = await attachItineraryWeather([itinerary], ctx());

    expect(getForecastSpy).toHaveBeenCalledTimes(2);
    expect(result!.weather).toBeDefined();
    expect(result!.weather!.originWeather).not.toBeNull();
    expect(result!.weather!.destinationWeather).not.toBeNull();
    expect(result!.weather!.legOutdoorWaits).toHaveLength(2);
  });
});

describe("attachItineraryWeather — outdoor wait threshold", () => {
  function singleTransferItinerary(waitMinutes: number): TransitItinerary {
    const startTime = 1778166000000;
    const firstLegEnd = startTime + 5 * 60_000;
    const transitStart = firstLegEnd + waitMinutes * 60_000;
    return {
      startTime,
      endTime: transitStart + 20 * 60_000,
      duration: (transitStart - startTime + 20 * 60_000) / 1000,
      walkDistance: 200,
      transfers: 0,
      legs: [
        {
          mode: "WALK",
          startTime,
          endTime: firstLegEnd,
          duration: 300,
          distance: 200,
          from: { name: "Origin", ...HEL_ORIGIN },
          to: { name: "Stop A", ...HEL_PASILA },
        },
        {
          mode: "BUS",
          startTime: transitStart,
          endTime: transitStart + 20 * 60_000,
          duration: 1200,
          distance: 5000,
          from: { name: "Stop A", ...HEL_PASILA },
          to: { name: "Destination", ...TPE_DEST },
        },
      ],
    };
  }

  it("does not emit a wait entry when gap is exactly 5 min", async () => {
    vi.spyOn(
      openMeteoModule.openMeteoForecast,
      "getForecast",
    ).mockImplementation(async (lat, lon) =>
      buildForecast(lat, lon, 1778166000000),
    );
    const [result] = await attachItineraryWeather(
      [singleTransferItinerary(5)],
      ctx(),
    );
    expect(result!.weather!.legOutdoorWaits).toHaveLength(0);
  });

  it("emits a wait entry when gap is 6 min", async () => {
    vi.spyOn(
      openMeteoModule.openMeteoForecast,
      "getForecast",
    ).mockImplementation(async (lat, lon) =>
      buildForecast(lat, lon, 1778166000000),
    );
    const [result] = await attachItineraryWeather(
      [singleTransferItinerary(6)],
      ctx(),
    );
    expect(result!.weather!.legOutdoorWaits).toHaveLength(1);
    expect(result!.weather!.legOutdoorWaits[0]!.outdoorWaitMin).toBe(6);
  });
});

describe("attachItineraryWeather — non-wait legs ignored", () => {
  it("does not flag a WALK leg following a transit leg as outdoor wait", async () => {
    vi.spyOn(
      openMeteoModule.openMeteoForecast,
      "getForecast",
    ).mockImplementation(async (lat, lon) =>
      buildForecast(lat, lon, 1778166000000),
    );
    const startTime = 1778166000000;
    const itinerary: TransitItinerary = {
      startTime,
      endTime: startTime + 30 * 60_000,
      duration: 1800,
      walkDistance: 200,
      transfers: 0,
      legs: [
        {
          mode: "BUS",
          startTime,
          endTime: startTime + 15 * 60_000,
          duration: 900,
          distance: 5000,
          from: { name: "Origin", ...HEL_ORIGIN },
          to: { name: "Stop A", ...HEL_PASILA },
        },
        {
          mode: "WALK",
          // 10 min gap, but the next leg is WALK — the user is walking,
          // not waiting outdoors.
          startTime: startTime + 25 * 60_000,
          endTime: startTime + 30 * 60_000,
          duration: 300,
          distance: 200,
          from: { name: "Stop A", ...HEL_PASILA },
          to: { name: "Destination", ...HEL_ORIGIN },
        },
      ],
    };

    const [result] = await attachItineraryWeather([itinerary], ctx());
    expect(result!.weather!.legOutdoorWaits).toHaveLength(0);
  });
});

describe("attachItineraryWeather — past horizon", () => {
  it("returns null weather for a depart time beyond the forecast horizon", async () => {
    const startTime = 1778166000000;
    const farFuture = startTime + 30 * 24 * 3_600_000;

    vi.spyOn(
      openMeteoModule.openMeteoForecast,
      "getForecast",
    ).mockImplementation(async (lat, lon) =>
      buildForecast(lat, lon, startTime),
    );

    const itinerary: TransitItinerary = {
      startTime: farFuture,
      endTime: farFuture + 20 * 60_000,
      duration: 1200,
      walkDistance: 0,
      transfers: 0,
      legs: [
        {
          mode: "BUS",
          startTime: farFuture,
          endTime: farFuture + 20 * 60_000,
          duration: 1200,
          distance: 5000,
          from: { name: "Origin", ...HEL_ORIGIN },
          to: { name: "Destination", ...HEL_PASILA },
        },
      ],
    };

    const [result] = await attachItineraryWeather([itinerary], ctx());
    expect(result!.weather!.originWeather).toBeNull();
    expect(result!.weather!.destinationWeather).toBeNull();
  });
});

describe("attachItineraryWeather — upstream failure", () => {
  it("falls back to null when getForecast throws, without rejecting", async () => {
    vi.spyOn(
      openMeteoModule.openMeteoForecast,
      "getForecast",
    ).mockRejectedValue(new Error("upstream down"));
    const startTime = 1778166000000;
    const itinerary: TransitItinerary = {
      startTime,
      endTime: startTime + 20 * 60_000,
      duration: 1200,
      walkDistance: 0,
      transfers: 0,
      legs: [
        {
          mode: "BUS",
          startTime,
          endTime: startTime + 20 * 60_000,
          duration: 1200,
          distance: 5000,
          from: { name: "Origin", ...HEL_ORIGIN },
          to: { name: "Destination", ...HEL_PASILA },
        },
      ],
    };

    const [result] = await attachItineraryWeather([itinerary], ctx());
    expect(result!.weather).toBeDefined();
    expect(result!.weather!.originWeather).toBeNull();
    expect(result!.weather!.destinationWeather).toBeNull();
  });
});
