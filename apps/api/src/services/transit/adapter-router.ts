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
 * Region codes that the FE region facet (and `preferences.transitRegion`)
 * surface. `"all"` and any unknown value fall through to the Finland-wide
 * adapter so cross-region queries still resolve — the user-facing contract
 * is "this never errors on an unknown region", not strict enum enforcement.
 */
export type RegionCode = "all" | "hsl" | "waltti" | "varely";

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
  /**
   * Adapter for a user-chosen region code (line-search facet,
   * `preferences.transitRegion`). `"all"` and unknown values resolve to the
   * Finland-wide adapter, so callers don't need to defend against typos.
   */
  forRegion(region: RegionCode | string | undefined): DigitransitAdapter;
  /** Every adapter, regardless of enablement. Used by tooling. */
  all(): DigitransitAdapter[];
}

export const adapterRouter: AdapterRouter = {
  forStopId: (gtfsId) => adapterForGtfsId(gtfsId),
  forCoordinate: (_lat, _lon) => defaultAdapter(),
  forSearch: () => defaultAdapter(),
  forRegion: (region) => {
    switch (region) {
      case "hsl":
        if (digitransitHsl.enabled()) return digitransitHsl;
        return defaultAdapter();
      case "waltti":
        if (digitransitWaltti.enabled()) return digitransitWaltti;
        return defaultAdapter();
      case "varely":
        if (digitransitVarely.enabled()) return digitransitVarely;
        return defaultAdapter();
      default:
        return defaultAdapter();
    }
  },
  all: () => [
    digitransitFinland,
    digitransitHsl,
    digitransitWaltti,
    digitransitVarely,
  ],
};
