export interface TransitSubStop {
  gtfsId: string;
  code: string | null;
  platformCode: string | null;
  vehicleMode: string | null;
}

export interface TransitStop {
  gtfsId: string;
  name: string;
  code: string | null;
  lat: number;
  lon: number;
  vehicleMode: string | null;
  platformCode: string | null;
  /** Distance in meters from search point (nearby searches only). */
  distance?: number;
  /** All vehicle modes available at this stop/station (for grouped results). */
  vehicleModes?: string[];
  /** True if this is a station (use station query for departures). */
  isStation?: boolean;
  /** Child stops within this station/cluster for the given mode. */
  subStops?: TransitSubStop[];
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
}

export interface TransitItinerary {
  startTime: number;
  endTime: number;
  duration: number;
  walkDistance: number;
  transfers: number;
  legs: TransitItineraryLeg[];
}

export interface TransitPlanResult {
  itineraries: TransitItinerary[];
  message?: string;
}
