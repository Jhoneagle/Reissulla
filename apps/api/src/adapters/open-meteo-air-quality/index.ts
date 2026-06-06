import type { AdapterContext } from "../types.js";
import {
  createAirQualityClient,
  type OpenMeteoAirQualityClient,
} from "./client.js";
import type {
  AirQualitySnapshot,
  OpenMeteoAirQualityResponse,
  PollenSnapshot,
} from "./types.js";

/**
 * Open-Meteo Air Quality adapter. Exposes current AQI + pollutant readings
 * and a per-taxon pollen snapshot consumed by the weather composition
 * service that backs `/api/v1/weather/snapshot`.
 */

const CURRENT_VARS = [
  "european_aqi",
  "pm10",
  "pm2_5",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "carbon_monoxide",
].join(",");

const HOURLY_VARS = [
  "alder_pollen",
  "birch_pollen",
  "grass_pollen",
  "mugwort_pollen",
  "olive_pollen",
  "ragweed_pollen",
].join(",");

function optionalCount(value: number | null | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export interface OpenMeteoAirQualityAdapter {
  readonly source: "open-meteo-air-quality";
  readonly baseUrl: string;
  getCurrent(
    lat: number,
    lon: number,
    ctx: AdapterContext,
  ): Promise<{ airQuality: AirQualitySnapshot; pollen: PollenSnapshot }>;
}

function buildAdapter(
  client: OpenMeteoAirQualityClient,
): OpenMeteoAirQualityAdapter {
  return {
    source: "open-meteo-air-quality",
    baseUrl: client.baseUrl,

    async getCurrent(lat, lon, ctx) {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: CURRENT_VARS,
        hourly: HOURLY_VARS,
        timezone: "auto",
      });
      const raw = await client.request<OpenMeteoAirQualityResponse>(
        params,
        ctx,
      );

      const c = raw.current;
      const airQuality: AirQualitySnapshot = {
        europeanAqi: c.european_aqi,
        pm10: c.pm10,
        pm2_5: c.pm2_5,
        nitrogenDioxide: c.nitrogen_dioxide,
        sulphurDioxide: c.sulphur_dioxide,
        ozone: c.ozone,
        carbonMonoxide: c.carbon_monoxide,
        timestamp: c.time,
      };

      // TODO: pick the next hour ≥ now once the composition service threads
      // a clock through AdapterContext. For now we surface index 0 — the
      // earliest hour Open-Meteo returns for the requested day — which is
      // the conservative default for a snapshot consumed at boot.
      const h = raw.hourly;
      const idx = 0;
      const pollen: PollenSnapshot = {
        alder: optionalCount(h.alder_pollen[idx]),
        birch: optionalCount(h.birch_pollen[idx]),
        grass: optionalCount(h.grass_pollen[idx]),
        mugwort: optionalCount(h.mugwort_pollen[idx]),
        olive: optionalCount(h.olive_pollen[idx]),
        ragweed: optionalCount(h.ragweed_pollen[idx]),
        timestamp: h.time[idx] ?? c.time,
      };

      return { airQuality, pollen };
    },
  };
}

export const openMeteoAirQuality: OpenMeteoAirQualityAdapter = buildAdapter(
  createAirQualityClient(),
);
