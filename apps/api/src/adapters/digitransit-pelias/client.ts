import { config } from "../../config.js";
import type { AdapterContext } from "../types.js";

const FETCH_TIMEOUT_MS = 10_000;

export interface PeliasFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    gid: string;
    layer: string;
    source: string;
    name: string;
    label: string;
    confidence?: number;
    accuracy?: string;
    country?: string;
    region?: string;
    locality?: string;
    neighbourhood?: string;
    street?: string;
    housenumber?: string;
    postalcode?: string;
  };
}

export interface PeliasResponse {
  type: "FeatureCollection";
  features: PeliasFeature[];
}

export interface PeliasClient {
  readonly source: "digitransit-pelias";
  readonly baseUrl: string;
  request(
    endpoint: string,
    params: URLSearchParams,
    ctx: AdapterContext,
  ): Promise<PeliasResponse>;
}

function apiKeyHeaders(): Record<string, string> {
  return config.digitransitApiKey
    ? { "digitransit-subscription-key": config.digitransitApiKey }
    : {};
}

export function createPeliasClient(baseUrl: string): PeliasClient {
  return {
    source: "digitransit-pelias",
    baseUrl,
    async request(
      endpoint: string,
      params: URLSearchParams,
      ctx: AdapterContext,
    ): Promise<PeliasResponse> {
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const signal = AbortSignal.any([ctx.signal, timeoutSignal]);

      const url = `${baseUrl}/${endpoint}?${params}`;

      let res: Response;
      try {
        res = await fetch(url, { headers: apiKeyHeaders(), signal });
      } catch (err) {
        if (timeoutSignal.aborted) {
          throw new Error(
            `Digitransit Pelias ${endpoint} timed out after ${FETCH_TIMEOUT_MS}ms`,
            { cause: err },
          );
        }
        throw new Error(
          `Digitransit Pelias ${endpoint} network error: ${(err as Error).message}`,
          { cause: err },
        );
      }

      if (!res.ok) {
        throw new Error(
          `Digitransit Pelias ${endpoint} HTTP ${res.status} ${res.statusText}`,
        );
      }

      return res.json();
    },
  };
}
