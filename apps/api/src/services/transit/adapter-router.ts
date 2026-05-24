import { digitransitFinland } from "../../adapters/digitransit-finland/index.js";
import { digitransitHsl } from "../../adapters/digitransit-hsl/index.js";
import { digitransitVarely } from "../../adapters/digitransit-varely/index.js";
import { digitransitWaltti } from "../../adapters/digitransit-waltti/index.js";
import type { DigitransitAdapter } from "../../adapters/digitransit-routing/adapter.js";
import {
  adapterForGtfsId,
  defaultAdapter,
} from "../../adapters/digitransit-routing/dispatch.js";

/**
 * Single entry point that every transit service uses to pick a Digitransit
 * adapter. Wraps the prefix-driven dispatch and the broad-coverage default,
 * so call sites stop importing `dispatch.ts` directly and gain a place to
 * grow coordinate-aware routing without touching consumers.
 */
export interface AdapterRouter {
  /** Adapter that owns the feed for this stop / line / trip id. */
  forStopId(gtfsId: string): DigitransitAdapter;
  /**
   * Adapter that covers a coordinate. Today this returns the Finland-wide
   * union for every input; the signature carries lat/lon so the upcoming
   * cross-region itinerary work can route by bounding box without
   * touching call sites.
   */
  forCoordinate(lat: number, lon: number): DigitransitAdapter;
  /**
   * Adapter for cross-region string queries (stop / line search) where no
   * coordinate is available. Same backing as `forCoordinate` for now;
   * separate method keeps the call site intent explicit.
   */
  forSearch(): DigitransitAdapter;
  /** Every adapter, regardless of enablement. Used by tooling. */
  all(): DigitransitAdapter[];
}

export const adapterRouter: AdapterRouter = {
  forStopId: (gtfsId) => adapterForGtfsId(gtfsId),
  forCoordinate: (_lat, _lon) => defaultAdapter(),
  forSearch: () => defaultAdapter(),
  all: () => [
    digitransitFinland,
    digitransitHsl,
    digitransitWaltti,
    digitransitVarely,
  ],
};
