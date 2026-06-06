/**
 * FMI fixtures. WFS warnings are keyed by region code (e.g. "FI:Uusimaa")
 * with `""` as the "no region filter" default; the radar timeline is
 * keyed by `"latest"` to match the sliding window the adapter exposes.
 */

export interface FmiErrorMarker {
  /** Discriminator — handler returns the given HTTP status when this is set. */
  readonly httpError: number;
}

export type FmiFixture<T> = T | FmiErrorMarker;

export function isErrorMarker(value: unknown): value is FmiErrorMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { httpError?: unknown }).httpError === "number"
  );
}

export { warningsByRegion, radarTimelineByKey } from "./helsinki.js";
export type { RadarFrameFixture } from "./helsinki.js";
