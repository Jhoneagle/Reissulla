import {
  HELSINKI_COORD,
  WEATHER_ERROR_COORD,
  WEATHER_NETWORK_ERROR_COORD,
} from "../../scenarios.js";
import type { FintrafficFixture } from "./index.js";

/**
 * Canonical Fintraffic road-conditions response. The "near Helsinki" section
 * is anchored at HELSINKI_COORD so the adapter's nearest-section selector
 * resolves to it for any Helsinki-region query. Two further sections sit a
 * little further out so the Haversine loop has actual candidates to reject.
 */
const helsinkiRoadConditions = {
  dataUpdatedTime: "2026-05-05T12:00:00Z",
  weatherData: [
    {
      id: 1001,
      sectionName: "Helsinki keskusta",
      coordinates: {
        latitude: HELSINKI_COORD.lat,
        longitude: HELSINKI_COORD.lon,
      },
      forecast: [
        {
          time: "2026-05-05T12:00:00Z",
          forecastName: "Nyt",
          roadCondition: "DRY",
          weather: "Selkeää",
          roadTemperature: 8.4,
        },
        {
          time: "2026-05-05T14:00:00Z",
          forecastName: "+2h",
          roadCondition: "DRY",
          weather: "Selkeää",
          roadTemperature: 9.1,
        },
      ],
    },
    {
      id: 1002,
      sectionName: "Espoo Otaniemi",
      coordinates: { latitude: 60.184, longitude: 24.829 },
      forecast: [
        {
          time: "2026-05-05T12:00:00Z",
          forecastName: "Nyt",
          roadCondition: "WET",
          weather: "Sade",
          roadTemperature: 6.2,
        },
      ],
    },
    {
      id: 1003,
      sectionName: "Vantaa Tikkurila",
      coordinates: { latitude: 60.292, longitude: 25.041 },
      forecast: [
        {
          time: "2026-05-05T12:00:00Z",
          forecastName: "Nyt",
          roadCondition: "PARTLY_ICY",
          weather: "Pakkasta",
          roadTemperature: -2.1,
        },
      ],
    },
  ],
};

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/**
 * Fintraffic exposes a single nationwide payload — there are no coord
 * parameters on the upstream URL. The MSW handler keys lookups by the literal
 * `"default"`; tests that need an error path mutate the registry directly.
 * The shared WEATHER_* error coords are recorded too so any future per-coord
 * dispatch can pick them up without re-keying.
 */
export const roadConditionsRegistry: Record<
  string,
  FintrafficFixture<typeof helsinkiRoadConditions>
> = {
  default: helsinkiRoadConditions,
  [coordKey(WEATHER_ERROR_COORD.lat, WEATHER_ERROR_COORD.lon)]: {
    httpError: 503,
  },
  [coordKey(WEATHER_NETWORK_ERROR_COORD.lat, WEATHER_NETWORK_ERROR_COORD.lon)]:
    {
      httpError: 0,
    },
};
