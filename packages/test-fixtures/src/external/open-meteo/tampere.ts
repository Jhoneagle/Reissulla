import { TAMPERE_COORD } from "../../scenarios.js";
import type { OpenMeteoFixture } from "./index.js";

/**
 * Tampere current + forecast fixtures keyed by the cache-precision coord.
 *
 * Times follow open-meteo's `timezone: "auto"` convention (Europe/Helsinki
 * local, no timezone suffix) so the trip-weather composer's matcher
 * exercises the same parse path as production traffic. The values
 * deliberately differ from the Helsinki fixture (cooler temperatures,
 * higher precipitation probability) so a cross-region test can assert
 * the destination forecast is *Tampere's*, not just "any non-null".
 */

const tampereCurrent = {
  latitude: TAMPERE_COORD.lat,
  longitude: TAMPERE_COORD.lon,
  current: {
    time: "2026-05-05T12:00",
    temperature_2m: 9.8,
    apparent_temperature: 7.6,
    relative_humidity_2m: 78,
    wind_speed_10m: 3.2,
    wind_direction_10m: 195,
    weather_code: 3,
    is_day: 1,
  },
};

const tampereForecast = {
  latitude: TAMPERE_COORD.lat,
  longitude: TAMPERE_COORD.lon,
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
    temperature_2m: [7.4, 8.1, 9.0, 9.8, 10.3, 10.5, 10.2, 9.6],
    relative_humidity_2m: [85, 80, 78, 78, 75, 72, 74, 80],
    precipitation_probability: [40, 45, 50, 55, 60, 60, 55, 50],
    weather_code: [3, 3, 61, 61, 63, 61, 51, 3],
    wind_speed_10m: [3.0, 3.1, 3.2, 3.2, 3.4, 3.5, 3.3, 3.0],
  },
  daily: {
    time: ["2026-05-05"],
    temperature_2m_max: [10.5],
    temperature_2m_min: [4.2],
    precipitation_probability_max: [65],
    weather_code: [61],
    sunrise: ["2026-05-05T04:55"],
    sunset: ["2026-05-05T21:35"],
  },
};

export const tampereCurrentByCoord: Record<
  string,
  OpenMeteoFixture<typeof tampereCurrent>
> = {
  [`${TAMPERE_COORD.lat.toFixed(2)},${TAMPERE_COORD.lon.toFixed(2)}`]:
    tampereCurrent,
};

export const tampereForecastByCoord: Record<
  string,
  OpenMeteoFixture<typeof tampereForecast>
> = {
  [`${TAMPERE_COORD.lat.toFixed(2)},${TAMPERE_COORD.lon.toFixed(2)}`]:
    tampereForecast,
};
