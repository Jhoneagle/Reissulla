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
}

export interface TransitDeparture {
  routeShortName: string;
  routeLongName: string;
  headsign: string;
  scheduledDeparture: number;
  realtimeDeparture: number;
  departureDelay: number;
  realtime: boolean;
  serviceDay: string;
  vehicleMode: string;
}

export interface TransitDeparturesResult {
  stopName: string | null;
  departures: TransitDeparture[];
  message?: string;
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
