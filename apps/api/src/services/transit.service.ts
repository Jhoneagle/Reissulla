import type {
  TransitStop,
  TransitDeparture,
  TransitDeparturesResult,
  TransitItinerary,
  TransitItineraryLeg,
  TransitPlanResult,
} from "@reissulla/shared";
import { config } from "../config.js";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { tryCache } from "../utils/resilience.js";

const ROUTING_URL =
  "https://api.digitransit.fi/routing/v2/finland/gtfs/v1";
const FETCH_TIMEOUT_MS = 10_000;

const STOPS_CACHE_TTL = 3600; // 1 hour
const DEPARTURES_CACHE_TTL = 60; // 1 minute
const PLAN_CACHE_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

async function digitransitGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ROUTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.digitransitApiKey
        ? { "digitransit-subscription-key": config.digitransitApiKey }
        : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `Digitransit routing API error: ${res.status} ${res.statusText}`,
    );
  }

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors?.length) {
    throw new Error(
      `Digitransit GraphQL error: ${json.errors[0]!.message}`,
    );
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Nearby stops
// ---------------------------------------------------------------------------

const NEARBY_STOPS_QUERY = `
  query NearbyStops($lat: Float!, $lon: Float!, $radius: Int!) {
    nearest(lat: $lat, lon: $lon, maxDistance: $radius, filterByPlaceTypes: [STOP]) {
      edges {
        node {
          distance
          place {
            ... on Stop {
              gtfsId
              name
              code
              lat
              lon
              vehicleMode
              platformCode
            }
          }
        }
      }
    }
  }
`;

interface NearbyStopsData {
  nearest: {
    edges: {
      node: {
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
      };
    }[];
  };
}

export async function getNearbyStops(
  lat: number,
  lon: number,
  radiusMeters = 500,
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const key = `transit:stops-nearby:${lat.toFixed(3)}:${lon.toFixed(3)}:${radiusMeters}`;
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const raw = await digitransitGraphQL<NearbyStopsData>(NEARBY_STOPS_QUERY, {
    lat,
    lon,
    radius: radiusMeters,
  });

  const data: TransitStop[] = raw.nearest.edges.map((edge) => ({
    gtfsId: edge.node.place.gtfsId,
    name: edge.node.place.name,
    code: edge.node.place.code,
    lat: edge.node.place.lat,
    lon: edge.node.place.lon,
    vehicleMode: edge.node.place.vehicleMode,
    platformCode: edge.node.place.platformCode,
    distance: edge.node.distance,
  }));

  await tryCache(() => cacheSet(key, data, STOPS_CACHE_TTL));
  return { data, cached: false };
}

// ---------------------------------------------------------------------------
// Search stops by name
// ---------------------------------------------------------------------------

const SEARCH_STOPS_AND_STATIONS_QUERY = `
  query SearchStopsAndStations($name: String!) {
    stops(name: $name) {
      gtfsId
      name
      code
      lat
      lon
      vehicleMode
      platformCode
    }
    stations(name: $name) {
      gtfsId
      name
      lat
      lon
      vehicleMode
      stops {
        vehicleMode
      }
    }
  }
`;

interface SearchStopsAndStationsData {
  stops: {
    gtfsId: string;
    name: string;
    code: string | null;
    lat: number;
    lon: number;
    vehicleMode: string | null;
    platformCode: string | null;
  }[];
  stations: {
    gtfsId: string;
    name: string;
    lat: number;
    lon: number;
    vehicleMode: string | null;
    stops: { vehicleMode: string | null }[];
  }[];
}

/**
 * Normalize stop name for grouping — strip platform suffixes like "(M)", "(A)", etc.
 * "Itäkeskus (M)" → "itäkeskus", "Itäkeskus" → "itäkeskus"
 */
function normalizeStopName(name: string): string {
  return name
    .replace(/\s*\([^)]{1,3}\)\s*$/, "") // strip short parenthetical suffixes
    .toLowerCase()
    .trim();
}

/**
 * Group individual stops by normalized name and merge stations.
 * Each unique name becomes one result with combined vehicleModes.
 */
function groupStopsByName(
  stops: SearchStopsAndStationsData["stops"],
  stations: SearchStopsAndStationsData["stations"],
): TransitStop[] {
  const grouped = new Map<
    string,
    { stop: TransitStop; modes: Set<string> }
  >();

  // Add stations first (they get priority — include train stations)
  for (const st of stations) {
    const key = normalizeStopName(st.name);
    const modes = new Set<string>();
    if (st.vehicleMode) modes.add(st.vehicleMode);
    for (const child of st.stops) {
      if (child.vehicleMode) modes.add(child.vehicleMode);
    }
    if (!grouped.has(key)) {
      grouped.set(key, {
        stop: {
          gtfsId: st.gtfsId,
          name: st.name,
          code: null,
          lat: st.lat,
          lon: st.lon,
          vehicleMode: st.vehicleMode,
          platformCode: null,
          isStation: true,
        },
        modes,
      });
    } else {
      const existing = grouped.get(key)!;
      for (const m of modes) existing.modes.add(m);
    }
  }

  // Add stops, grouping by normalized name
  for (const s of stops) {
    const key = normalizeStopName(s.name);
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      if (s.vehicleMode) existing.modes.add(s.vehicleMode);
    } else {
      const modes = new Set<string>();
      if (s.vehicleMode) modes.add(s.vehicleMode);
      grouped.set(key, {
        stop: {
          gtfsId: s.gtfsId,
          name: s.name,
          code: s.code,
          lat: s.lat,
          lon: s.lon,
          vehicleMode: s.vehicleMode,
          platformCode: s.platformCode,
          isStation: false,
        },
        modes,
      });
    }
  }

  return Array.from(grouped.values()).map(({ stop, modes }) => ({
    ...stop,
    vehicleModes: Array.from(modes).sort(),
  }));
}

export async function searchStops(
  query: string,
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const key = `transit:stops-search:${query.toLowerCase()}`;
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const raw = await digitransitGraphQL<SearchStopsAndStationsData>(
    SEARCH_STOPS_AND_STATIONS_QUERY,
    { name: query },
  );

  const data = groupStopsByName(raw.stops, raw.stations);

  await tryCache(() => cacheSet(key, data, STOPS_CACHE_TTL));
  return { data, cached: false };
}

// ---------------------------------------------------------------------------
// Departures at a stop
// ---------------------------------------------------------------------------

const STOP_DEPARTURES_QUERY = `
  query StopDepartures($id: String!, $n: Int!) {
    stop(id: $id) {
      name
      stoptimesWithoutPatterns(numberOfDepartures: $n) {
        scheduledDeparture
        realtimeDeparture
        departureDelay
        realtime
        serviceDay
        headsign
        trip {
          route {
            shortName
            longName
            mode
          }
        }
      }
    }
  }
`;

const STATION_DEPARTURES_QUERY = `
  query StationDepartures($id: String!, $n: Int!) {
    station(id: $id) {
      name
      stoptimesWithoutPatterns(numberOfDepartures: $n) {
        scheduledDeparture
        realtimeDeparture
        departureDelay
        realtime
        serviceDay
        headsign
        trip {
          route {
            shortName
            longName
            mode
          }
        }
      }
    }
  }
`;

interface StoptimeData {
  scheduledDeparture: number;
  realtimeDeparture: number;
  departureDelay: number;
  realtime: boolean;
  serviceDay: number;
  headsign: string;
  trip: {
    route: {
      shortName: string;
      longName: string;
      mode: string;
    };
  };
}

interface StopDeparturesData {
  stop: { name: string; stoptimesWithoutPatterns: StoptimeData[] } | null;
}

interface StationDeparturesData {
  station: { name: string; stoptimesWithoutPatterns: StoptimeData[] } | null;
}

function mapStoptimes(stoptimes: StoptimeData[]): TransitDeparture[] {
  return stoptimes.map((st) => ({
    routeShortName: st.trip.route.shortName,
    routeLongName: st.trip.route.longName,
    headsign: st.headsign,
    scheduledDeparture: st.scheduledDeparture,
    realtimeDeparture: st.realtimeDeparture,
    departureDelay: st.departureDelay,
    realtime: st.realtime,
    serviceDay: st.serviceDay,
    vehicleMode: st.trip.route.mode,
  }));
}

export async function getStopDepartures(
  stopId: string,
  count = 20,
  isStation = false,
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const key = `transit:departures:${stopId}`;
  const cached = await tryCache(
    () => cacheGet<TransitDeparturesResult>(key),
  );
  if (cached) return { data: cached, cached: true };

  let stopName: string | null = null;
  let stoptimes: StoptimeData[] = [];

  if (isStation) {
    const raw = await digitransitGraphQL<StationDeparturesData>(
      STATION_DEPARTURES_QUERY,
      { id: stopId, n: count },
    );
    if (raw.station) {
      stopName = raw.station.name;
      stoptimes = raw.station.stoptimesWithoutPatterns;
    }
  } else {
    const raw = await digitransitGraphQL<StopDeparturesData>(
      STOP_DEPARTURES_QUERY,
      { id: stopId, n: count },
    );
    if (raw.stop) {
      stopName = raw.stop.name;
      stoptimes = raw.stop.stoptimesWithoutPatterns;
    }
  }

  if (!stopName) {
    const data: TransitDeparturesResult = {
      stopName: null,
      departures: [],
      message:
        "Stop not found or outside transit coverage area",
    };
    return { data, cached: false };
  }

  const departures = mapStoptimes(stoptimes);

  const data: TransitDeparturesResult = {
    stopName,
    departures,
  };

  await tryCache(() => cacheSet(key, data, DEPARTURES_CACHE_TTL));
  return { data, cached: false };
}

// ---------------------------------------------------------------------------
// Route planning
// ---------------------------------------------------------------------------

// CoordinateValue is a custom scalar in OTP2 — cannot use Float variables.
// Build the query with inlined coordinate values instead.
function buildPlanQuery(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  n: number,
): string {
  return `{
    planConnection(
      origin: { location: { coordinate: { latitude: ${fromLat}, longitude: ${fromLon} } } }
      destination: { location: { coordinate: { latitude: ${toLat}, longitude: ${toLon} } } }
      first: ${n}
      modes: {
        direct: [WALK]
        transit: { transit: [{ mode: BUS }, { mode: RAIL }, { mode: TRAM }, { mode: SUBWAY }, { mode: FERRY }] }
      }
    ) {
      edges {
        node {
          startTime
          endTime
          numberOfTransfers
          walkDistance
          legs {
            mode
            startTime
            endTime
            duration
            distance
            from {
              name
              lat
              lon
              stop { gtfsId code }
            }
            to {
              name
              lat
              lon
              stop { gtfsId code }
            }
            route { shortName longName }
            intermediateStops { name gtfsId }
          }
        }
      }
    }
  }`;
}

interface PlanConnectionData {
  planConnection: {
    edges: {
      node: {
        startTime: number;
        endTime: number;
        numberOfTransfers: number;
        walkDistance: number;
        legs: {
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
        }[];
      };
    }[];
  } | null;
}

export async function planRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  numItineraries = 5,
): Promise<{ data: TransitPlanResult; cached: boolean }> {
  const key = `transit:plan:${fromLat.toFixed(3)}:${fromLon.toFixed(3)}:${toLat.toFixed(3)}:${toLon.toFixed(3)}`;
  const cached = await tryCache(() => cacheGet<TransitPlanResult>(key));
  if (cached) return { data: cached, cached: true };

  const query = buildPlanQuery(fromLat, fromLon, toLat, toLon, numItineraries);
  const raw = await digitransitGraphQL<PlanConnectionData>(query, {});

  const edges = raw.planConnection?.edges ?? [];

  if (edges.length === 0) {
    const data: TransitPlanResult = {
      itineraries: [],
      message:
        "No transit routes found between these locations. They may be outside the transit coverage area.",
    };
    return { data, cached: false };
  }

  const itineraries: TransitItinerary[] = edges.map((edge) => {
    const node = edge.node;
    const legs: TransitItineraryLeg[] = node.legs.map((leg) => ({
      mode: leg.mode,
      startTime: leg.startTime,
      endTime: leg.endTime,
      duration: leg.duration,
      distance: leg.distance,
      from: {
        name: leg.from.name,
        lat: leg.from.lat,
        lon: leg.from.lon,
        stop: leg.from.stop ?? undefined,
      },
      to: {
        name: leg.to.name,
        lat: leg.to.lat,
        lon: leg.to.lon,
        stop: leg.to.stop ?? undefined,
      },
      route: leg.route ?? undefined,
      intermediateStops: leg.intermediateStops ?? undefined,
    }));

    return {
      startTime: node.startTime,
      endTime: node.endTime,
      duration: legs.reduce((sum, l) => sum + l.duration, 0),
      walkDistance: node.walkDistance,
      transfers: node.numberOfTransfers,
      legs,
    };
  });

  const data: TransitPlanResult = { itineraries };
  await tryCache(() => cacheSet(key, data, PLAN_CACHE_TTL));
  return { data, cached: false };
}
