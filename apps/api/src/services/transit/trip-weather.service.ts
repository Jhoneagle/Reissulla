import {
  helsinkiHourStamp,
  type HourlyForecast,
  type ItineraryWeather,
  type LegOutdoorWait,
  type TransitItinerary,
  type TransitItineraryLeg,
  type WeatherForecast,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { WEATHER_FORECAST_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { openMeteoForecast } from "../../adapters/open-meteo-forecast/index.js";
import type { AdapterContext } from "../../adapters/types.js";

/**
 * Itinerary-weather composition (Phase 3 Chunk 6 / technical-plan §5.5).
 *
 * For each itinerary in a planRoute result, attaches the hourly forecast at
 * the origin (depart-time) and destination (arrive-time), plus per-leg
 * outdoor-wait notes whenever the gap between two consecutive legs exceeds
 * five minutes. The user is presumed to be waiting outdoors on the boarding
 * leg's platform / curb during that gap.
 *
 * Dedup strategy: candidate points across every itinerary are bucketed by
 * `${lat.toFixed(2)}:${lon.toFixed(2)}` (≈1 km). One `getForecast` call per
 * distinct bucket; the per-point hour is then selected from the returned
 * `hourly[]`. Concurrent requests for the same bucket share a single in-
 * flight promise so a 4-leg itinerary with two legs in the same hour at
 * adjacent coords issues at most two upstream calls (plan §9.3).
 *
 * The cache key matches the lightweight `/weather/forecast` slot
 * (`weather:forecast:v1:<lat>:<lon>`) deliberately — a dashboard fetch
 * primes the planner's lookup and vice-versa, and the 30-min TTL is the
 * right shelf life for "depart in 20 minutes" planning.
 */

const OUTDOOR_WAIT_MIN_THRESHOLD = 5;

function bucketKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

async function getForecastCached(
  lat: number,
  lon: number,
  ctx: AdapterContext,
): Promise<WeatherForecast | null> {
  const key = cacheKey(
    "weather",
    "forecast",
    1,
    lat.toFixed(2),
    lon.toFixed(2),
  );
  const hit = await tryCache(() => cacheGet<WeatherForecast>(key));
  if (hit !== null) return hit;
  try {
    const data = await openMeteoForecast.getForecast(lat, lon, ctx);
    await tryCache(() => cacheSet(key, data, WEATHER_FORECAST_TTL));
    return data;
  } catch {
    return null;
  }
}

/**
 * Pick the `HourlyForecast` entry whose Helsinki-local hour stamp matches
 * `targetUnixMs`. Returns null when the forecast is null (upstream
 * failure) or when no entry matches the target hour — that's the "past
 * the horizon" branch (Open-Meteo returns 7 days of hourly data).
 */
function pickHour(
  forecast: WeatherForecast | null,
  targetUnixMs: number,
): HourlyForecast | null {
  if (forecast === null) return null;
  const hourly = forecast.hourly;
  if (hourly.length === 0) return null;

  const targetStamp = helsinkiHourStamp(targetUnixMs);
  return hourly.find((hour) => hour.time.slice(0, 13) === targetStamp) ?? null;
}

interface CandidatePoint {
  lat: number;
  lon: number;
  unixMs: number;
}

interface PendingItinerary {
  origin: CandidatePoint;
  destination: CandidatePoint;
  waits: { legIndex: number; outdoorWaitMin: number; point: CandidatePoint }[];
}

function gatherCandidates(itinerary: TransitItinerary): PendingItinerary {
  const firstLeg = itinerary.legs[0];
  const lastLeg = itinerary.legs[itinerary.legs.length - 1];

  const origin: CandidatePoint = firstLeg
    ? {
        lat: firstLeg.from.lat,
        lon: firstLeg.from.lon,
        unixMs: itinerary.startTime,
      }
    : { lat: 0, lon: 0, unixMs: itinerary.startTime };

  const destination: CandidatePoint = lastLeg
    ? { lat: lastLeg.to.lat, lon: lastLeg.to.lon, unixMs: itinerary.endTime }
    : { lat: 0, lon: 0, unixMs: itinerary.endTime };

  const waits: PendingItinerary["waits"] = [];
  for (let i = 1; i < itinerary.legs.length; i++) {
    const prev = itinerary.legs[i - 1] as TransitItineraryLeg;
    const next = itinerary.legs[i] as TransitItineraryLeg;
    // Walking legs are active movement, not outdoor waiting. The user is
    // only "waiting" when the next leg is a vehicle they need to catch.
    if (next.mode === "WALK") continue;
    const gapMs = next.startTime - prev.endTime;
    if (gapMs <= 0) continue;
    const waitMin = Math.round(gapMs / 60_000);
    if (waitMin <= OUTDOOR_WAIT_MIN_THRESHOLD) continue;
    waits.push({
      legIndex: i,
      outdoorWaitMin: waitMin,
      point: { lat: next.from.lat, lon: next.from.lon, unixMs: next.startTime },
    });
  }

  return { origin, destination, waits };
}

/**
 * Mutates each itinerary in `itineraries` to attach the optional `weather`
 * envelope. Safe to call on an empty array; returns the same reference so
 * callers can keep chaining.
 *
 * Designed to swallow upstream weather errors per-bucket — a failed
 * forecast call resolves to `null` for that point, the rest of the
 * envelope still ships. The planner endpoint must never reject because
 * the weather composer hiccuped.
 */
export async function attachItineraryWeather(
  itineraries: TransitItinerary[],
  ctx: AdapterContext,
): Promise<TransitItinerary[]> {
  if (itineraries.length === 0) return itineraries;

  const pending = itineraries.map(gatherCandidates);

  // Collect distinct coord buckets across every itinerary's candidate set.
  const bucketToCoord = new Map<string, { lat: number; lon: number }>();
  for (const it of pending) {
    for (const point of [
      it.origin,
      it.destination,
      ...it.waits.map((w) => w.point),
    ]) {
      const key = bucketKey(point.lat, point.lon);
      if (!bucketToCoord.has(key)) {
        bucketToCoord.set(key, { lat: point.lat, lon: point.lon });
      }
    }
  }

  // One upstream fetch per distinct bucket, all parallel. Shared promises
  // mean repeated coords inside the same call reuse the in-flight request.
  const bucketForecasts = new Map<string, Promise<WeatherForecast | null>>();
  for (const [key, coord] of bucketToCoord) {
    bucketForecasts.set(key, getForecastCached(coord.lat, coord.lon, ctx));
  }
  await Promise.all(bucketForecasts.values());

  function lookup(point: CandidatePoint): Promise<HourlyForecast | null> {
    const promise = bucketForecasts.get(bucketKey(point.lat, point.lon));
    return promise === undefined
      ? Promise.resolve(null)
      : promise.then((forecast) => pickHour(forecast, point.unixMs));
  }

  await Promise.all(
    itineraries.map(async (itinerary, idx) => {
      const slot = pending[idx]!;
      const [originWeather, destinationWeather, waitWeather] =
        await Promise.all([
          lookup(slot.origin),
          lookup(slot.destination),
          Promise.all(
            slot.waits.map(async (w) => ({
              ...w,
              weather: await lookup(w.point),
            })),
          ),
        ]);

      const legOutdoorWaits: LegOutdoorWait[] = waitWeather.map((w) => ({
        legIndex: w.legIndex,
        outdoorWaitMin: w.outdoorWaitMin,
        weather: w.weather,
      }));

      const summary: ItineraryWeather = {
        originWeather,
        destinationWeather,
        legOutdoorWaits,
      };

      itinerary.weather = summary;
    }),
  );

  return itineraries;
}

// Helpers exported for unit tests — they cover edge cases that aren't
// observable through the top-level entry point (hour bucketing tolerance,
// candidate dedup) without forcing the test to drive a full itinerary
// fixture through the cache layer.
export const __test = {
  bucketKey,
  pickHour,
  gatherCandidates,
  helsinkiHourStamp,
};
