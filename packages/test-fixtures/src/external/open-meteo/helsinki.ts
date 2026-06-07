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
    // Span 09:00–16:00 Helsinki-local so the trip-weather composer can pick
    // every leg's hour from a single planned itinerary; the planner fixture
    // anchors at 2026-05-05T12:00 Helsinki.
    time: [
      "2026-05-05T09:00",
      "2026-05-05T10:00",
      "2026-05-05T11:00",
      "2026-05-05T12:00",
      "2026-05-05T13:00",
      "2026-05-05T14:00",
      "2026-05-05T15:00",
      "2026-05-05T16:00",
    ],
    temperature_2m: [12.0, 13.1, 14.2, 15.2, 16.0, 16.4, 16.2, 15.6],
    relative_humidity_2m: [70, 67, 66, 65, 60, 58, 60, 64],
    precipitation_probability: [10, 12, 15, 10, 20, 22, 18, 14],
    weather_code: [2, 2, 2, 2, 3, 3, 2, 2],
    wind_speed_10m: [5.2, 5.3, 5.4, 5.4, 6.1, 6.2, 5.8, 5.4],
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

// Suburban-Helsinki coord used as the destination on the canonical plan
// fixtures (60.17,24.94 → 60.20,24.96 etc). Same neighbourhood as
// HELSINKI_COORD, slightly cooler — letting the trip-weather composer
// distinguish origin vs destination by temperature.
const helsinkiSuburbCurrent = {
  ...helsinkiCurrent,
  latitude: 60.2,
  longitude: 24.96,
  current: {
    ...helsinkiCurrent.current,
    temperature_2m: 14.3,
    apparent_temperature: 12.1,
  },
};

const helsinkiSuburbForecast = {
  ...helsinkiForecast,
  latitude: 60.2,
  longitude: 24.96,
  hourly: {
    ...helsinkiForecast.hourly,
    temperature_2m: [11.2, 12.3, 13.5, 14.3, 15.1, 15.5, 15.3, 14.7],
  },
};

export const currentByCoord: Record<
  string,
  OpenMeteoFixture<typeof helsinkiCurrent>
> = {
  [coordKey(HELSINKI_COORD.lat, HELSINKI_COORD.lon)]: helsinkiCurrent,
  [coordKey(60.2, 24.96)]: helsinkiSuburbCurrent,
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
  [coordKey(60.2, 24.96)]: helsinkiSuburbForecast,
  [coordKey(WEATHER_ERROR_COORD.lat, WEATHER_ERROR_COORD.lon)]: {
    httpError: 503,
  },
  [coordKey(WEATHER_NETWORK_ERROR_COORD.lat, WEATHER_NETWORK_ERROR_COORD.lon)]:
    {
      httpError: 0,
    },
};
