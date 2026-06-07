/**
 * Open-Meteo fixtures keyed by `${lat.toFixed(2)},${lon.toFixed(2)}` to
 * match the cache-key precision used by the API service.
 */

export interface OpenMeteoErrorMarker {
  /** Discriminator — handler returns the given HTTP status when this is set. */
  readonly httpError: number;
}

export type OpenMeteoFixture<T> = T | OpenMeteoErrorMarker;

export function isErrorMarker(value: unknown): value is OpenMeteoErrorMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { httpError?: unknown }).httpError === "number"
  );
}

import {
  currentByCoord as helsinkiCurrentByCoord,
  forecastByCoord as helsinkiForecastByCoord,
} from "./helsinki.js";
import { pasilaCurrentByCoord, pasilaForecastByCoord } from "./pasila.js";
import { tampereCurrentByCoord, tampereForecastByCoord } from "./tampere.js";

/**
 * Combined coord registry — each region contributes one (or more) coord
 * bucket. Adding a new city is "drop a file, merge the spread into both
 * exports". The MSW handler keys lookup by `${lat.toFixed(2)},${lon.toFixed(2)}`
 * and throws on a miss, so any new coord that production code can hit
 * needs an entry here.
 */
export const currentByCoord = {
  ...helsinkiCurrentByCoord,
  ...pasilaCurrentByCoord,
  ...tampereCurrentByCoord,
};

export const forecastByCoord = {
  ...helsinkiForecastByCoord,
  ...pasilaForecastByCoord,
  ...tampereForecastByCoord,
};
