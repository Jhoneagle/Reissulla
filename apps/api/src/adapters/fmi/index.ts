import type { AdapterContext } from "../types.js";
import { createFmiClient, type FmiClient } from "./client.js";
import { parseFmiWarnings } from "./parse-warnings.js";
import type { FmiWarning, RadarFrame } from "./types.js";

/**
 * FMI adapter. Surfaces active regional warnings (via WFS/GML) and a
 * sliding radar timeline (WMS GetMap frames at ~5 minute spacing) for
 * the weather composition service backing `/api/v1/weather/snapshot`.
 */

const RADAR_FRAME_INTERVAL_SECONDS = 5 * 60;

export interface FmiAdapter {
  readonly source: "fmi";
  readonly wfsBaseUrl: string;
  readonly wmsBaseUrl: string;
  getWarnings(
    args: { region: string },
    ctx: AdapterContext,
  ): Promise<FmiWarning[]>;
  getRadarTimeline(
    args: { minutesBack: number },
    ctx: AdapterContext,
  ): Promise<RadarFrame[]>;
  getRadarTileUrl(args: {
    z: number;
    x: number;
    y: number;
    timestamp: number;
  }): string;
}

function buildAdapter(client: FmiClient): FmiAdapter {
  return {
    source: "fmi",
    wfsBaseUrl: client.wfsBaseUrl,
    wmsBaseUrl: client.wmsBaseUrl,

    async getWarnings({ region }, ctx) {
      const params = new URLSearchParams({
        service: "WFS",
        version: "2.0.0",
        request: "getFeature",
        storedquery_id: "fmi::warnings::regional",
      });
      if (region) params.set("region", region);

      const xml = await client.requestXml(params, ctx);
      const warnings = parseFmiWarnings(xml, ctx.locale);
      return region
        ? warnings.filter((w) => w.region === region || w.region === "")
        : warnings;
    },

    async getRadarTimeline({ minutesBack }, _ctx) {
      const frameCount = Math.max(
        1,
        Math.floor((minutesBack * 60) / RADAR_FRAME_INTERVAL_SECONDS),
      );
      const nowSeconds = Math.floor(Date.now() / 1000);
      // Snap to the previous 5-minute boundary so successive callers within
      // the same interval get the same timeline (and therefore cache key).
      const latest =
        Math.floor(nowSeconds / RADAR_FRAME_INTERVAL_SECONDS) *
        RADAR_FRAME_INTERVAL_SECONDS;

      const frames: RadarFrame[] = [];
      for (let i = frameCount - 1; i >= 0; i--) {
        const timestamp = latest - i * RADAR_FRAME_INTERVAL_SECONDS;
        const tileUrlTemplate = client.composeTileUrlTemplate({ timestamp });
        frames.push({ timestamp, tileUrlTemplate });
      }
      return frames;
    },

    getRadarTileUrl({ z, x, y, timestamp }) {
      return client.composeTileUrl({ z, x, y, timestamp });
    },
  };
}

export const fmiAdapter: FmiAdapter = buildAdapter(createFmiClient());

export type { FmiWarning, RadarFrame } from "./types.js";
export type {
  FmiWarningSeverity,
  FmiWarningType,
  GeoJsonPolygon,
} from "./types.js";
