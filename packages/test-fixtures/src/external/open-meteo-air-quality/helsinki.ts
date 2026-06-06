import {
  HELSINKI_COORD,
  WEATHER_ERROR_COORD,
  WEATHER_NETWORK_ERROR_COORD,
} from "../../scenarios.js";
import type { OpenMeteoAirQualityFixture } from "./index.js";

/** Open-Meteo /v1/air-quality current + hourly response, scheduled fields only. */
const helsinkiAirQuality = {
  latitude: HELSINKI_COORD.lat,
  longitude: HELSINKI_COORD.lon,
  current: {
    time: "2026-05-05T12:00",
    european_aqi: 32,
    pm10: 12.4,
    pm2_5: 6.1,
    nitrogen_dioxide: 8.7,
    sulphur_dioxide: 1.2,
    ozone: 78.5,
    carbon_monoxide: 210.0,
  },
  hourly: {
    time: ["2026-05-05T12:00", "2026-05-05T13:00"],
    alder_pollen: [0.4, 0.3],
    birch_pollen: [2.1, 2.4],
    grass_pollen: [0.0, 0.1],
    mugwort_pollen: [0.0, 0.0],
    olive_pollen: [0.0, 0.0],
    ragweed_pollen: [0.0, 0.0],
  },
};

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export const airQualityByCoord: Record<
  string,
  OpenMeteoAirQualityFixture<typeof helsinkiAirQuality>
> = {
  [coordKey(HELSINKI_COORD.lat, HELSINKI_COORD.lon)]: helsinkiAirQuality,
  [coordKey(WEATHER_ERROR_COORD.lat, WEATHER_ERROR_COORD.lon)]: {
    httpError: 503,
  },
  [coordKey(WEATHER_NETWORK_ERROR_COORD.lat, WEATHER_NETWORK_ERROR_COORD.lon)]:
    {
      httpError: 0,
    },
};
