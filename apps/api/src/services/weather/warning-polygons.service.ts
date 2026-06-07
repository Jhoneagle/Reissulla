import type { WeatherWarning } from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { WEATHER_WARNINGS_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { fmiAdapter } from "../../adapters/fmi/index.js";
import type { AdapterContext, AdapterLocale } from "../../adapters/types.js";

/**
 * Returns the full national (or per-region) set of active FMI warnings for
 * the map warnings overlay. Reuses the same cache key as the composition
 * snapshot's warnings slot so the overlay request doesn't double-fetch
 * when both surfaces are open at once.
 */
export interface WarningPolygonsResult {
  data: WeatherWarning[];
  cached: boolean;
}

export async function getWarningPolygons(opts: {
  region?: string;
  locale: AdapterLocale;
  signal?: AbortSignal;
}): Promise<WarningPolygonsResult> {
  const region = opts.region ?? "";
  const key = cacheKey("weather", "warnings", 2, region, opts.locale);

  const hit = await tryCache(() => cacheGet<WeatherWarning[]>(key));
  if (hit !== null) return { data: hit, cached: true };

  const ctx: AdapterContext = {
    signal: opts.signal ?? new AbortController().signal,
    locale: opts.locale,
  };
  const data = await fmiAdapter.getWarnings({ region }, ctx);
  await tryCache(() => cacheSet(key, data, WEATHER_WARNINGS_TTL));
  return { data, cached: false };
}
