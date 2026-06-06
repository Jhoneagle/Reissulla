import { config } from "../../config.js";
import type { AdapterContext } from "../types.js";

/**
 * Thin fetch wrapper for FMI Open Data. The WFS endpoint returns GML/XML,
 * so this client reads the response as text and leaves parsing to the
 * caller. Mirrors the AbortSignal merging used by the Open-Meteo client —
 * a 10s timeout runs alongside the caller's signal so a slow upstream
 * never wedges the snapshot fan-out beyond budget.
 */

const FETCH_TIMEOUT_MS = 10_000;

export const FMI_WFS_BASE = "https://opendata.fmi.fi/wfs";
export const FMI_WMS_BASE = "https://openwms.fmi.fi/geoserver/wms";

export interface FmiClient {
  readonly source: "fmi";
  readonly wfsBaseUrl: string;
  readonly wmsBaseUrl: string;
  requestXml(params: URLSearchParams, ctx: AdapterContext): Promise<string>;
  composeTileUrl(args: {
    z: number;
    x: number;
    y: number;
    timestamp: number;
    layer?: string;
  }): string;
  composeTileUrlTemplate(args: { timestamp: number; layer?: string }): string;
}

function userAgentHeaders(): Record<string, string> {
  return { "User-Agent": config.fmiUserAgent };
}

export function createFmiClient(
  wfsBaseUrl: string = FMI_WFS_BASE,
  wmsBaseUrl: string = FMI_WMS_BASE,
): FmiClient {
  return {
    source: "fmi",
    wfsBaseUrl,
    wmsBaseUrl,

    async requestXml(
      params: URLSearchParams,
      ctx: AdapterContext,
    ): Promise<string> {
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const signal = AbortSignal.any([ctx.signal, timeoutSignal]);

      const url = `${wfsBaseUrl}?${params}`;
      let res: Response;
      try {
        res = await fetch(url, { headers: userAgentHeaders(), signal });
      } catch (err) {
        if (timeoutSignal.aborted) {
          throw new Error(`FMI WFS timed out after ${FETCH_TIMEOUT_MS}ms`, {
            cause: err,
          });
        }
        throw new Error(`FMI WFS network error: ${(err as Error).message}`, {
          cause: err,
        });
      }

      if (!res.ok) {
        throw new Error(`FMI WFS HTTP ${res.status} ${res.statusText}`);
      }

      return res.text();
    },

    composeTileUrl({ z, x, y, timestamp, layer = "Radar:suomi_rr_eureffin" }) {
      // FMI publishes WMS at openwms.fmi.fi. The {z}/{x}/{y}.png shape is a
      // convention for the tile renderer downstream — the TIME parameter
      // identifies the radar frame and is the load-bearing piece here.
      const tail = tileQueryTail(
        layer,
        timestamp,
        String(z),
        String(x),
        String(y),
      );
      return `${wmsBaseUrl}/${z}/${x}/${y}.png?${tail}`;
    },

    composeTileUrlTemplate({ timestamp, layer = "Radar:suomi_rr_eureffin" }) {
      // `{z}/{x}/{y}` placeholders stay raw — URLSearchParams would
      // percent-encode the curly braces, breaking the template contract.
      const tail = tileQueryTail(layer, timestamp, "{z}", "{x}", "{y}");
      return `${wmsBaseUrl}/{z}/{x}/{y}.png?${tail}`;
    },
  };
}

function tileQueryTail(
  layer: string,
  timestamp: number,
  z: string,
  x: string,
  y: string,
): string {
  const iso = new Date(timestamp * 1000).toISOString();
  const encoded = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: layer,
    FORMAT: "image/png",
    TRANSPARENT: "true",
    TIME: iso,
  });
  return `${encoded}&TILEMATRIX=${z}&TILECOL=${x}&TILEROW=${y}`;
}
