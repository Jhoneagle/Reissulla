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
}

export interface TransitDeparture {
  routeShortName: string;
  routeLongName: string;
  headsign: string;
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
}

export interface TransitDeparturesResult {
  stopName: string | null;
  departures: TransitDeparture[];
  message?: string;
  /** Sub-stop metadata for building the platform filter UI. */
  subStops?: TransitSubStop[];
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
}

export interface TransitPlanResult {
  itineraries: TransitItinerary[];
  message?: string;
}
