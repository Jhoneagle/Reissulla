/**
 * Open-Meteo Air Quality fixtures keyed by `${lat.toFixed(2)},${lon.toFixed(2)}`
 * to match the cache-key precision used by the API service.
 */

export interface OpenMeteoAirQualityErrorMarker {
  /** Discriminator — handler returns the given HTTP status when this is set. */
  readonly httpError: number;
}

export type OpenMeteoAirQualityFixture<T> = T | OpenMeteoAirQualityErrorMarker;

export function isErrorMarker(
  value: unknown,
): value is OpenMeteoAirQualityErrorMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { httpError?: unknown }).httpError === "number"
  );
}

export { airQualityByCoord } from "./helsinki.js";
