import type { TransitMode } from "./trip.js";

/**
 * Trip drill-down primitives consumed by the trip-detail page and the
 * `getTripDetail` API. Shape mirrors the GTFS trip but with epochs already
 * resolved on the server (offset-from-midnight → unix seconds) so the FE
 * consumes the same time contract as `TransitDeparture`.
 */

export interface TripDetailStop {
  gtfsId: string;
  name: string;
  platformCode: string | null;
  /**
   * Unix seconds. Server resolves the trip's anchor service date and
   * converts the GTFS offset-from-midnight to a real epoch before
   * returning. FE consumes plain unix throughout — same contract as
   * TransitDeparture's derived times.
   */
  arrivalTime: number;
  departureTime: number;
  scheduledArrival: number;
  scheduledDeparture: number;
  /** Seconds; positive = late, negative = early, 0 = on time. */
  arrivalDelay: number;
  departureDelay: number;
  realtime: boolean;
  /**
   * 0..n-1 slot in the pattern. Maps from upstream
   * `Stoptime.stopPositionInPattern: Int!` (guaranteed-consecutive field).
   */
  stopPositionInPattern: number;
  /**
   * False when GTFS pickupType is NONE — passengers cannot board here
   * (typical at the terminus). Default true. Mirrors
   * `TransitDeparture.canBoard`.
   */
  canBoard: boolean;
  /**
   * False when GTFS dropoffType is NONE — passengers cannot alight here
   * (typical at the origin). Default true.
   */
  canAlight: boolean;
}

export interface TripDetail {
  tripId: string;
  route: {
    gtfsId: string;
    shortName: string;
    longName: string;
    mode: TransitMode;
    /** Hex without `#`. Null when the feed has no colour. */
    color: string | null;
  };
  pattern: {
    /**
     * GTFS direction. 0/1 = outbound/inbound. `null` when the pattern
     * only runs in one direction (upstream `Trip.directionId: String`
     * carries "0" / "1" / null; server maps String → number).
     */
    directionId: 0 | 1 | null;
    headsign: string;
  };
  agency: {
    gtfsId: string;
    name: string;
  };
  /** YYYYMMDD — the activeDate the server anchored the times to. */
  serviceDate: string;
  /** All activeDates returned by upstream, sorted ascending. */
  serviceDates: string[];
  stops: TripDetailStop[];
}
