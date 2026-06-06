import type {
  CurrentWeather,
  Persona,
  WeatherForecast,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import {
  WEATHER_AQ_TTL,
  WEATHER_CURRENT_TTL,
  WEATHER_FORECAST_TTL,
  WEATHER_POLLEN_TTL,
  WEATHER_ROADS_TTL,
  WEATHER_WARNINGS_TTL,
} from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { openMeteoForecast } from "../../adapters/open-meteo-forecast/index.js";
import { openMeteoAirQuality } from "../../adapters/open-meteo-air-quality/index.js";
import type {
  AirQualitySnapshot,
  PollenSnapshot,
} from "../../adapters/open-meteo-air-quality/types.js";
import { fmiAdapter } from "../../adapters/fmi/index.js";
import type { FmiWarning } from "../../adapters/fmi/types.js";
import { fintrafficAdapter } from "../../adapters/fintraffic/index.js";
import type { RoadCondition } from "../../adapters/fintraffic/types.js";
import type { AdapterContext, AdapterLocale } from "../../adapters/types.js";
import { getRainNowcast, type RainNowcast } from "./nowcast.service.js";
import { isPointInsidePolygon } from "./warning-intersect.js";

/**
 * Composition layer for the weather snapshot — fans out to every upstream
 * in parallel and caches each piece on its own clock so a fast-moving
 * warnings miss doesn't reflow a 30-min air-quality read. The dashboard
 * calls this once per primary card; the legacy /weather/current and
 * /weather/forecast endpoints stay on the lightweight per-piece clock for
 * the list-row consumers that don't need the rest of the payload.
 */

export interface WeatherSnapshot {
  current: CurrentWeather | null;
  forecast: WeatherForecast | null;
  airQuality: AirQualitySnapshot | null;
  pollen: PollenSnapshot | null;
  warnings: FmiWarning[];
  roadConditions: RoadCondition | null;
  nowcast: RainNowcast | null;
}

export interface SnapshotOptions {
  persona?: Persona;
  locale: AdapterLocale;
  /** FMI area code for warnings filtering. Defaults to the country code. */
  region?: string;
}

export interface SnapshotResult {
  data: WeatherSnapshot;
  /**
   * Per-piece source health. `cached: true` means served from Redis;
   * `failed: true` means the upstream throw was swallowed and the piece
   * is null/empty in the payload.
   */
  meta: {
    current: { cached: boolean; failed: boolean };
    forecast: { cached: boolean; failed: boolean };
    airQuality: { cached: boolean; failed: boolean };
    pollen: { cached: boolean; failed: boolean };
    warnings: { cached: boolean; failed: boolean };
    roadConditions: { cached: boolean; failed: boolean };
    nowcast: { cached: boolean; failed: boolean };
  };
}

function coord(lat: number, lon: number): [string, string] {
  return [lat.toFixed(2), lon.toFixed(2)];
}

async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T | null; cached: boolean; failed: boolean }> {
  const hit = await tryCache(() => cacheGet<T>(key));
  if (hit !== null) return { data: hit, cached: true, failed: false };
  try {
    const data = await fetcher();
    await tryCache(() => cacheSet(key, data, ttl));
    return { data, cached: false, failed: false };
  } catch {
    return { data: null, cached: false, failed: true };
  }
}

export async function getWeatherSnapshot(
  lat: number,
  lon: number,
  opts: SnapshotOptions,
): Promise<SnapshotResult> {
  const ctx: AdapterContext = {
    signal: new AbortController().signal,
    locale: opts.locale,
    persona: opts.persona,
  };
  // Empty region asks FMI for the full national set; the local polygon
  // intersect below filters to the requested coordinate. Real FMI usage
  // can pass a tighter area code when a future caller wants pre-filtering.
  const region = opts.region ?? "";
  const [latKey, lonKey] = coord(lat, lon);

  const [
    currentResult,
    forecastResult,
    aqPollenResult,
    warningsResult,
    roadsResult,
    nowcastResult,
  ] = await Promise.all([
    withCache(
      cacheKey("weather", "current", 1, latKey, lonKey),
      WEATHER_CURRENT_TTL,
      () => openMeteoForecast.getCurrent(lat, lon, ctx),
    ),
    withCache(
      cacheKey("weather", "forecast", 1, latKey, lonKey),
      WEATHER_FORECAST_TTL,
      () => openMeteoForecast.getForecast(lat, lon, ctx),
    ),
    withCache(
      cacheKey("weather", "aq", 1, latKey, lonKey),
      WEATHER_AQ_TTL,
      () => openMeteoAirQuality.getCurrent(lat, lon, ctx),
    ),
    withCache(
      cacheKey("weather", "warnings", 1, region, opts.locale),
      WEATHER_WARNINGS_TTL,
      () => fmiAdapter.getWarnings({ region }, ctx),
    ),
    withCache(
      cacheKey("weather", "roads", 1, latKey, lonKey),
      WEATHER_ROADS_TTL,
      () => fintrafficAdapter.getRoadConditions(lat, lon, ctx),
    ),
    withCache(
      cacheKey("weather", "nowcast", 1, latKey, lonKey),
      // Pollen cache TTL is not used by the nowcast itself; the cache key
      // for the nowcast is its own slot per ttl.ts. The stub returns null
      // until the radar chunk lands; cached miss → null on every call.
      WEATHER_POLLEN_TTL,
      () => getRainNowcast(lat, lon),
    ),
  ]);

  const aqMeta = {
    cached: aqPollenResult.cached,
    failed: aqPollenResult.failed,
  };

  const allWarnings = warningsResult.data ?? [];
  const matchingWarnings = filterWarningsForPoint(allWarnings, lat, lon);

  return {
    data: {
      current: currentResult.data,
      forecast: forecastResult.data,
      airQuality: aqPollenResult.data?.airQuality ?? null,
      pollen: aqPollenResult.data?.pollen ?? null,
      warnings: matchingWarnings,
      roadConditions: roadsResult.data,
      nowcast: nowcastResult.data,
    },
    meta: {
      current: { cached: currentResult.cached, failed: currentResult.failed },
      forecast: {
        cached: forecastResult.cached,
        failed: forecastResult.failed,
      },
      airQuality: aqMeta,
      pollen: aqMeta,
      warnings: {
        cached: warningsResult.cached,
        failed: warningsResult.failed,
      },
      roadConditions: {
        cached: roadsResult.cached,
        failed: roadsResult.failed,
      },
      nowcast: { cached: nowcastResult.cached, failed: nowcastResult.failed },
    },
  };
}

function filterWarningsForPoint(
  warnings: readonly FmiWarning[],
  lat: number,
  lon: number,
): FmiWarning[] {
  return warnings.filter((w) => {
    if (w.bounds === undefined) return true;
    return isPointInsidePolygon(lat, lon, w.bounds);
  });
}
