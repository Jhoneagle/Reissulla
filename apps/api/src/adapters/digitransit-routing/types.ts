export interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

export interface RawNearestEdge {
  distance: number;
  place: {
    gtfsId: string;
    name: string;
    code: string | null;
    lat: number;
    lon: number;
    vehicleMode: string | null;
    platformCode: string | null;
  };
}

export interface RawNearestData {
  nearest: {
    edges: { node: RawNearestEdge }[];
  };
}

export interface RawStationChildStop {
  gtfsId: string;
  name: string;
  code: string | null;
  platformCode: string | null;
  vehicleMode: string | null;
}

export interface RawStop {
  gtfsId: string;
  name: string;
  code: string | null;
  lat: number;
  lon: number;
  vehicleMode: string | null;
  platformCode: string | null;
}

export interface RawStation {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
  vehicleMode: string | null;
  stops: RawStationChildStop[];
}

export interface RawSearchStopsAndStationsData {
  stops: RawStop[];
  stations: RawStation[];
}

export interface RawStoptime {
  scheduledDeparture: number;
  realtimeDeparture: number;
  departureDelay: number;
  realtime: boolean;
  serviceDay: number;
  headsign: string;
  stop?: {
    gtfsId: string;
    platformCode: string | null;
    code: string | null;
  };
  trip: {
    route: {
      shortName: string;
      longName: string;
      mode: string;
    };
  };
}

export interface RawStopDeparturesData {
  stop: { name: string; stoptimesWithoutPatterns: RawStoptime[] } | null;
}

export interface RawStationDeparturesData {
  station: { name: string; stoptimesWithoutPatterns: RawStoptime[] } | null;
}

export interface RawPlanLeg {
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

export interface RawPlanConnectionEdge {
  node: {
    startTime: number;
    endTime: number;
    numberOfTransfers: number;
    walkDistance: number;
    legs: RawPlanLeg[];
  };
}

export interface RawPlanConnectionData {
  planConnection: { edges: RawPlanConnectionEdge[] } | null;
}

export interface PlanConnectionArgs {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  numItineraries: number;
}
