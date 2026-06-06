import {
  HELSINKI_COORD,
  WEATHER_ERROR_COORD,
  WEATHER_NETWORK_ERROR_COORD,
} from "../../scenarios.js";
import type { OpenMeteoFixture } from "./index.js";

/** Open-Meteo /v1/forecast current-weather response, scheduled fields only. */
const helsinkiCurrent = {
  latitude: HELSINKI_COORD.lat,
  longitude: HELSINKI_COORD.lon,
  current: {
    time: "2026-05-05T12:00",
    temperature_2m: 15.2,
    apparent_temperature: 13.1,
    relative_humidity_2m: 65,
    wind_speed_10m: 5.4,
    wind_direction_10m: 220,
    weather_code: 2,
    is_day: 1,
  },
};

const helsinkiForecast = {
  latitude: HELSINKI_COORD.lat,
  longitude: HELSINKI_COORD.lon,
  hourly: {
    time: ["2026-05-05T12:00", "2026-05-05T13:00"],
    temperature_2m: [15.2, 16.0],
    relative_humidity_2m: [65, 60],
    precipitation_probability: [10, 20],
    weather_code: [2, 3],
    wind_speed_10m: [5.4, 6.1],
  },
  daily: {
    time: ["2026-05-05"],
    temperature_2m_max: [18.0],
    temperature_2m_min: [8.5],
    precipitation_probability_max: [30],
    weather_code: [2],
    sunrise: ["2026-05-05T04:45"],
    sunset: ["2026-05-05T21:30"],
  },
};

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export const currentByCoord: Record<
  string,
  OpenMeteoFixture<typeof helsinkiCurrent>
> = {
  [coordKey(HELSINKI_COORD.lat, HELSINKI_COORD.lon)]: helsinkiCurrent,
  [coordKey(WEATHER_ERROR_COORD.lat, WEATHER_ERROR_COORD.lon)]: {
    httpError: 503,
  },
  [coordKey(WEATHER_NETWORK_ERROR_COORD.lat, WEATHER_NETWORK_ERROR_COORD.lon)]:
    {
      httpError: 0,
    },
};

export const forecastByCoord: Record<
  string,
  OpenMeteoFixture<typeof helsinkiForecast>
> = {
  [coordKey(HELSINKI_COORD.lat, HELSINKI_COORD.lon)]: helsinkiForecast,
  [coordKey(WEATHER_ERROR_COORD.lat, WEATHER_ERROR_COORD.lon)]: {
    httpError: 503,
  },
  [coordKey(WEATHER_NETWORK_ERROR_COORD.lat, WEATHER_NETWORK_ERROR_COORD.lon)]:
    {
      httpError: 0,
    },
};
