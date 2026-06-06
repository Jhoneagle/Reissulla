import { config } from "../../config.js";
import type { AdapterContext } from "../types.js";
import type { FintrafficRawResponse } from "./types.js";

/**
 * Thin fetch wrapper for Fintraffic's Digitraffic Road API. Mirrors the
 * Open-Meteo client's AbortSignal merging + 10s timeout so a slow upstream
 * never wedges a snapshot fan-out beyond the budget.
 */

const FETCH_TIMEOUT_MS = 10_000;

export const FINTRAFFIC_DEFAULT_BASE = "https://tie.digitraffic.fi";

const ROAD_CONDITIONS_PATH = "/api/weather/v1/forecast-sections/road-conditions";

export interface FintrafficClient {
  readonly source: "fintraffic";
  readonly baseUrl: string;
  fetchRoadConditions(ctx: AdapterContext): Promise<FintrafficRawResponse>;
}

function resolveBaseUrl(): string {
  return config.fintrafficApiBase !== ""
    ? config.fintrafficApiBase
    : FINTRAFFIC_DEFAULT_BASE;
}

export function createFintrafficClient(
  baseUrl: string = resolveBaseUrl(),
): FintrafficClient {
  return {
    source: "fintraffic",
    baseUrl,
    async fetchRoadConditions(
      ctx: AdapterContext,
    ): Promise<FintrafficRawResponse> {
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const signal = AbortSignal.any([ctx.signal, timeoutSignal]);

      const url = `${baseUrl}${ROAD_CONDITIONS_PATH}`;
      let res: Response;
      try {
        res = await fetch(url, { signal });
      } catch (err) {
        if (timeoutSignal.aborted) {
          throw new Error(
            `Fintraffic road-conditions timed out after ${FETCH_TIMEOUT_MS}ms`,
            { cause: err },
          );
        }
        throw new Error(
          `Fintraffic road-conditions network error: ${(err as Error).message}`,
          { cause: err },
        );
      }

      if (!res.ok) {
        throw new Error(
          `Fintraffic road-conditions HTTP ${res.status} ${res.statusText}`,
        );
      }

      return res.json() as Promise<FintrafficRawResponse>;
    },
  };
}
