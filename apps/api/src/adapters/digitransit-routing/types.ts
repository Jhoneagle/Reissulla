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

// ---- Line catalogue (routes / route / pattern / patterns) ------------------

export interface RawAgency {
  gtfsId: string;
  name: string;
}

export interface RawRouteMeta {
  gtfsId: string;
  shortName: string;
  longName: string;
  mode: string;
  color: string | null;
  textColor: string | null;
  agency: RawAgency | null;
}

export interface RawPatternMeta {
  code: string;
  headsign: string;
  directionId: number;
}

export interface RawPatternStop {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
  code: string | null;
  platformCode: string | null;
}

export interface RawPattern extends RawPatternMeta {
  stops: RawPatternStop[];
}

export interface RawRouteWithPatterns extends RawRouteMeta {
  patterns: RawPatternMeta[];
}

export interface RawRoutesData {
  routes: RawRouteMeta[];
}

export interface RawRouteData {
  route: RawRouteWithPatterns | null;
}

export interface RawPatternData {
  pattern: RawPattern | null;
}

export interface RawPatternsData {
  route: { patterns: RawPattern[] } | null;
}

// ---- Agency / service time range -------------------------------------------

export interface RawAgencyData {
  agency: RawAgency | null;
}

export interface RawServiceTimeRange {
  /** Unix seconds. */
  start: number;
  /** Unix seconds. */
  end: number;
}

export interface RawServiceTimeRangeData {
  serviceTimeRange: RawServiceTimeRange;
}

// ---- Trip drill-down -------------------------------------------------------

export interface RawTripStoptime {
  stop: {
    gtfsId: string;
    name: string;
    lat: number;
    lon: number;
    code: string | null;
    platformCode: string | null;
  };
  scheduledArrival: number;
  scheduledDeparture: number;
  realtimeArrival: number;
  realtimeDeparture: number;
  arrivalDelay: number;
  departureDelay: number;
  realtime: boolean;
  timepoint: boolean;
  stopPosition: number;
}

export interface RawTrip {
  gtfsId: string;
  tripHeadsign: string;
  route: RawRouteMeta;
  stoptimes: RawTripStoptime[];
}

export interface RawTripData {
  trip: RawTrip | null;
}

// ---- Trips for date / stoptimes for date -----------------------------------

export interface RawTripForDate {
  gtfsId: string;
  tripHeadsign: string;
  /** YYYYMMDD strings — service dates the trip is active on. */
  activeDates: string[];
}

export interface RawTripsForDateData {
  pattern: { code: string; tripsForDate: RawTripForDate[] } | null;
}

export interface RawStoptimeForDate {
  scheduledDeparture: number;
  realtimeDeparture: number;
  departureDelay: number;
  realtime: boolean;
  serviceDay: number;
  headsign: string;
  trip: { gtfsId: string };
}

export interface RawStoptimesForDateInPattern {
  pattern: {
    code: string;
    headsign: string;
    directionId: number;
    route: RawRouteMeta;
  };
  stoptimes: RawStoptimeForDate[];
}

export interface RawStoptimesForDateData {
  stop: {
    name: string;
    stoptimesForServiceDate: RawStoptimesForDateInPattern[];
  } | null;
}

// ---- Paged radius search ---------------------------------------------------

export interface RawStopAtDistance {
  distance: number;
  stop: {
    gtfsId: string;
    name: string;
    code: string | null;
    lat: number;
    lon: number;
    vehicleMode: string | null;
    platformCode: string | null;
  };
}

export interface RawStopsByRadiusEdge {
  cursor: string;
  node: RawStopAtDistance;
}

export interface RawStopsByRadiusPage {
  edges: RawStopsByRadiusEdge[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export interface RawStopsByRadiusData {
  stopsByRadius: RawStopsByRadiusPage | null;
}

// ---- Canceled trips / alerts (Phase 4 prep, no consumer yet) ---------------

export interface RawCanceledTripNode {
  trip: { gtfsId: string };
  scheduledDeparture: number;
  serviceDay: number;
}

export interface RawCanceledTripEdge {
  node: RawCanceledTripNode;
}

export interface RawCanceledTripsData {
  canceledTripTimes: { edges: RawCanceledTripEdge[] } | null;
}

export interface RawAlert {
  alertHeaderText: string | null;
  alertDescriptionText: string | null;
  alertSeverityLevel: string | null;
  effectiveStartDate: number | null;
  effectiveEndDate: number | null;
}

export interface RawAlertsData {
  alerts: RawAlert[];
}
