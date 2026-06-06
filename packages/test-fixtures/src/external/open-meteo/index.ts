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

export { currentByCoord, forecastByCoord } from "./helsinki.js";
