import { PASILA_COORD } from "../../scenarios.js";
import type { OpenMeteoFixture } from "./index.js";

/**
 * Pasila platform forecast — the HEL → TPE transfer point in the
 * cross-region plan fixture. Slightly cooler than Rautatientori (60.17)
 * to keep the destination test assertable separately, but still
 * "Helsinki weather" qualitatively.
 */

const pasilaCurrent = {
  latitude: PASILA_COORD.lat,
  longitude: PASILA_COORD.lon,
  current: {
    time: "2026-05-05T12:00",
    temperature_2m: 14.0,
    apparent_temperature: 12.5,
    relative_humidity_2m: 68,
    wind_speed_10m: 5.0,
    wind_direction_10m: 210,
    weather_code: 2,
    is_day: 1,
  },
};

const pasilaForecast = {
  latitude: PASILA_COORD.lat,
  longitude: PASILA_COORD.lon,
  hourly: {
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
    temperature_2m: [11.8, 12.6, 13.4, 14.0, 14.5, 14.6, 14.3, 13.7],
    relative_humidity_2m: [72, 68, 66, 65, 63, 62, 63, 67],
    precipitation_probability: [10, 15, 18, 20, 22, 22, 18, 14],
    weather_code: [2, 2, 2, 2, 3, 3, 2, 2],
    wind_speed_10m: [4.8, 4.9, 5.0, 5.0, 5.2, 5.3, 5.1, 4.8],
  },
  daily: {
    time: ["2026-05-05"],
    temperature_2m_max: [14.7],
    temperature_2m_min: [8.0],
    precipitation_probability_max: [25],
    weather_code: [2],
    sunrise: ["2026-05-05T04:45"],
    sunset: ["2026-05-05T21:30"],
  },
};

export const pasilaCurrentByCoord: Record<
  string,
  OpenMeteoFixture<typeof pasilaCurrent>
> = {
  [`${PASILA_COORD.lat.toFixed(2)},${PASILA_COORD.lon.toFixed(2)}`]:
    pasilaCurrent,
};

export const pasilaForecastByCoord: Record<
  string,
  OpenMeteoFixture<typeof pasilaForecast>
> = {
  [`${PASILA_COORD.lat.toFixed(2)},${PASILA_COORD.lon.toFixed(2)}`]:
    pasilaForecast,
};
