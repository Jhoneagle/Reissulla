import type { AdapterContext } from "../types.js";

/**
 * Thin fetch wrapper for Open-Meteo's Air Quality API. Mirrors the
 * Open-Meteo Forecast client: 10s timeout merged with the caller's signal
 * so a slow upstream never wedges a snapshot fan-out beyond the budget.
 */

const FETCH_TIMEOUT_MS = 10_000;

export const OPEN_METEO_AIR_QUALITY_BASE =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

export interface OpenMeteoAirQualityClient {
  readonly source: "open-meteo-air-quality";
  readonly baseUrl: string;
  request<T>(params: URLSearchParams, ctx: AdapterContext): Promise<T>;
}

export function createAirQualityClient(
  baseUrl: string = OPEN_METEO_AIR_QUALITY_BASE,
): OpenMeteoAirQualityClient {
  return {
    source: "open-meteo-air-quality",
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
            `Open-Meteo air-quality timed out after ${FETCH_TIMEOUT_MS}ms`,
            { cause: err },
          );
        }
        throw new Error(
          `Open-Meteo air-quality network error: ${(err as Error).message}`,
          { cause: err },
        );
      }

      if (!res.ok) {
        throw new Error(
          `Open-Meteo air-quality HTTP ${res.status} ${res.statusText}`,
        );
      }

      return res.json() as Promise<T>;
    },
  };
}
