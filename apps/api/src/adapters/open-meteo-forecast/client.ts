import type { AdapterContext } from "../types.js";

/**
 * Thin fetch wrapper for Open-Meteo's Forecast API. Shares the same
 * AbortSignal merging pattern as the Digitransit clients — a 10s timeout
 * runs alongside the caller's abort source so a slow upstream never wedges
 * a snapshot fan-out beyond the budget.
 */

const FETCH_TIMEOUT_MS = 10_000;

export const OPEN_METEO_FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

export interface OpenMeteoForecastClient {
  readonly source: "open-meteo";
  readonly baseUrl: string;
  request<T>(params: URLSearchParams, ctx: AdapterContext): Promise<T>;
}

export function createForecastClient(
  baseUrl: string = OPEN_METEO_FORECAST_BASE,
): OpenMeteoForecastClient {
  return {
    source: "open-meteo",
    baseUrl,
    async request<T>(params: URLSearchParams, ctx: AdapterContext): Promise<T> {
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const signal = AbortSignal.any([ctx.signal, timeoutSignal]);

      const url = `${baseUrl}?${params}`;
      let res: Response;
      try {
        res = await fetch(url, { signal });
      } catch (err) {
        if (timeoutSignal.aborted) {
          throw new Error(
            `Open-Meteo forecast timed out after ${FETCH_TIMEOUT_MS}ms`,
            { cause: err },
          );
        }
        throw new Error(
          `Open-Meteo forecast network error: ${(err as Error).message}`,
          { cause: err },
        );
      }

      if (!res.ok) {
        throw new Error(
          `Open-Meteo forecast HTTP ${res.status} ${res.statusText}`,
        );
      }

      return res.json() as Promise<T>;
    },
  };
}
