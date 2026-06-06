/**
 * Fintraffic fixtures. The upstream endpoint returns one nationwide payload
 * (no coord params), so the registry is keyed by the literal `"default"`;
 * tests drive error paths by swapping the `"default"` entry before each run.
 * Shared WEATHER_* error coords are also exposed here so any future per-coord
 * dispatch can pick them up.
 */

export interface FintrafficErrorMarker {
  /** Discriminator — handler returns the given HTTP status when this is set. */
  readonly httpError: number;
}

export type FintrafficFixture<T> = T | FintrafficErrorMarker;

export function isErrorMarker(value: unknown): value is FintrafficErrorMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { httpError?: unknown }).httpError === "number"
  );
}

export { roadConditionsRegistry } from "./helsinki.js";
