import type { ServiceDay } from "../utils/service-day.js";

/** GTFS wheelchair-boarding status surfaced to the FE. */
export type WheelchairBoarding = "POSSIBLE" | "NOT_POSSIBLE" | "NO_INFORMATION";

export interface TransitSubStop {
  gtfsId: string;
  code: string | null;
  platformCode: string | null;
  vehicleMode: string | null;
  wheelchairBoarding?: WheelchairBoarding;
}

export interface TransitStop {
  gtfsId: string;
  name: string;
  code: string | null;
  lat: number;
  lon: number;
  vehicleMode: string | null;
  platformCode: string | null;
  /** City / locality from reverse geocoding. */
  city?: string;
  /** Distance in meters from search point (nearby searches only). */
  distance?: number;
  /** All vehicle modes available at this stop/station (for grouped results). */
  vehicleModes?: string[];
  /** True if this is a station (use station query for departures). */
  isStation?: boolean;
  /** Child stops within this station/cluster for the given mode. */
  subStops?: TransitSubStop[];
  /**
   * GTFS wheelchair-boarding flag for the stop/station. Stations propagate
   * POSSIBLE if any child stop is POSSIBLE; NO_INFORMATION when the feed
   * has no signal. The FE uses this for the persona-driven accessible-first
   * sort and the A11Y-20 stop accessibility disclosure.
   */
  wheelchairBoarding?: WheelchairBoarding;
  /**
   * Operators serving this stop, deduplicated by gtfsId. Populated only
   * by the search endpoint (which fetches routes per stop); nearby and
   * single-stop queries skip the route fan-out and leave this undefined.
   * Backs the operator dropdown on the search filter row.
   */
  agencies?: { gtfsId: string; name: string }[];
}

export interface TransitDeparture {
  routeShortName: string;
  routeLongName: string;
  /**
   * Line gtfsId — the stable cross-region identifier ("HSL:1059" vs
   * "tampere:25"). Optional because legacy cached payloads pre-date the
   * field; new readers can fall back to routeShortName when needed.
   */
  routeGtfsId?: string;
  headsign: string;
  /**
   * Times are seconds within the service day. The same row carries
   * both arrival and departure times because a GTFS stoptime at a
   * through-stop is *both* events for the same vehicle: it arrives,
   * dwells, then departs. The FE picks which column to render based
   * on the user's arrivals/departures/both toggle.
   */
  scheduledArrival: number;
  realtimeArrival: number;
  arrivalDelay: number;
  scheduledDeparture: number;
  realtimeDeparture: number;
  departureDelay: number;
  realtime: boolean;
  serviceDay: number;
  vehicleMode: string;
  /** Which sub-stop this departure came from (for multi-stop queries). */
  stopId?: string;
  /** Platform code of the sub-stop (for display in platform filter). */
  platformCode?: string | null;
  /** Trip id — opens the trip drill-down. */
  tripId?: string;
  /** GTFS wheelchairAccessible on the trip; POSSIBLE means low-floor. */
  wheelchairAccessible?: WheelchairBoarding;
  /**
   * False when GTFS pickupType is NONE — no boarding here (terminus).
   * `mode=departures` hides rows where this is false. Default true.
   */
  canBoard?: boolean;
  /**
   * False when GTFS dropoffType is NONE — no alighting here (origin).
   * `mode=arrivals` hides rows where this is false. Default true.
   */
  canAlight?: boolean;
}

/**
 * How busy the stop's schedule is around the anchor moment. Drives the
 * masthead kicker copy on the departure board:
 *
 * - `dense`: surface "N lähtöä tunnissa" — the urban-hub treatment
 * - `moderate`: surface "Lähtöjä noin N minuutin välein" — suburban
 * - `sparse`: surface "Seuraava {time}" — rural / schooldays-only,
 *   paired with `TransitDeparturesResult.serviceNote`
 */
export type TransitFrequencyRegime = "dense" | "moderate" | "sparse";

export interface TransitFrequency {
  regime: TransitFrequencyRegime;
  /** Departures in the next 60 minutes after the anchor. */
  nextHourCount: number;
  /** Mean gap between departures in minutes within a representative window. */
  avgIntervalMin?: number;
  /**
   * Unix seconds of the next upcoming departure. Populated for sparse
   * regimes so the kicker can read "Seuraava huomenna 06.45" without
   * the FE re-deriving from the array.
   */
  nextDepartureUnix?: number;
}

export interface TransitDeparturesResult {
  stopName: string | null;
  departures: TransitDeparture[];
  message?: string;
  /** Sub-stop metadata for building the platform filter UI. */
  subStops?: TransitSubStop[];
  /**
   * Service day the response is anchored to (now or the future-time
   * picker target). Lets the FE render "Tomorrow's schedule" kickers
   * and resolve cross-midnight times consistently.
   */
  serviceDay?: ServiceDay;
  /**
   * Free-form day-type qualifier ("schooldays only", "summer only",
   * "weekends"). Populated for sparse-frequency stops where the
   * `tripsForDate` walk surfaced a meaningful pattern. Empty / absent
   * means the schedule has no notable qualifier.
   */
  serviceNote?: string;
  /** Departure-frequency classification — drives the kicker variant. */
  frequency?: TransitFrequency;
}

export interface TransitItineraryLeg {
  mode: string;
  startTime: number;
  endTime: number;
  duration: number;
  distance: number;
  from: {
    name: string;
    lat: number;
    lon: number;
    stop?: { gtfsId: string; code: string | null };
  };
  to: {
    name: string;
    lat: number;
    lon: number;
    stop?: { gtfsId: string; code: string | null };
  };
  route?: { shortName: string; longName: string };
  intermediateStops?: { name: string; gtfsId: string }[];
  /**
   * Operator behind this leg (HSL / VR / Nysse / …). Populated when the
   * service resolves `route.agency` for cross-region disambiguation.
   */
  operator?: { gtfsId: string; name: string };
  /**
   * OTP2 turn-by-turn for WALK legs. Empty / absent when upstream does not
   * surface step text — the UI renders nothing rather than an error.
   */
  steps?: { distance: number; relativeDirection: string; streetName: string }[];
}

export interface TransitItinerary {
  startTime: number;
  endTime: number;
  duration: number;
  walkDistance: number;
  transfers: number;
  legs: TransitItineraryLeg[];
  /**
   * True when the API has injected placeholder fare strings because the
   * fares service is not wired yet. UI renders "Fare to be calculated"
   * instead of a numeric total.
   */
  farePlaceholders?: boolean;
  /**
   * Persona flags that actually drove this plan call — the UI shows badges
   * only for the ones we honoured upstream. Mirrors persona inputs, not raw
   * persona state, so we don't claim "Step-free" when the planner ignored it.
   */
  appliedPersonaFlags?: {
    wheelchair?: boolean;
    lowFloor?: boolean;
    stroller?: boolean;
  };
}

export interface TransitPlanResult {
  itineraries: TransitItinerary[];
  message?: string;
}
