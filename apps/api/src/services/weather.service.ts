import type { CurrentWeather, WeatherForecast } from "@reissulla/shared";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import { WEATHER_CURRENT_TTL, WEATHER_FORECAST_TTL } from "../cache/ttl.js";
import { tryCache } from "../utils/resilience.js";
import { openMeteoForecast } from "../adapters/open-meteo-forecast/index.js";
import type { AdapterContext } from "../adapters/types.js";

/**
 * Lightweight wrapper around the Open-Meteo Forecast adapter. Backs the
 * Phase 1 `/api/v1/weather/current` and `/api/v1/weather/forecast` routes,
 * which Phase 3 keeps alive on purpose for the list-row consumers
 * (ListRowWeather, ListRowForecast) — see tmp-docs/phase-3-plan.md §5.2
 * for the N+1 rationale. The richer Phase 3 surface lands behind
 * `services/weather/composition.service.ts` and the new `/snapshot` route.
 */

function defaultContext(): AdapterContext {
  return { signal: new AbortController().signal, locale: "fi" };
}

export async function getCurrentWeather(
  lat: number,
  lon: number,
): Promise<{ data: CurrentWeather; cached: boolean }> {
  const key = cacheKey("weather", "current", 1, lat.toFixed(2), lon.toFixed(2));
  const cached = await tryCache(() => cacheGet<CurrentWeather>(key));
  if (cached) return { data: cached, cached: true };

  const data = await openMeteoForecast.getCurrent(lat, lon, defaultContext());
  await tryCache(() => cacheSet(key, data, WEATHER_CURRENT_TTL));
  return { data, cached: false };
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
): Promise<{ data: WeatherForecast; cached: boolean }> {
  const key = cacheKey(
    "weather",
    "forecast",
    1,
    lat.toFixed(2),
    lon.toFixed(2),
  );
  const cached = await tryCache(() => cacheGet<WeatherForecast>(key));
  if (cached) return { data: cached, cached: true };

  const data = await openMeteoForecast.getForecast(lat, lon, defaultContext());
  await tryCache(() => cacheSet(key, data, WEATHER_FORECAST_TTL));
  return { data, cached: false };
}
