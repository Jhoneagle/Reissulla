import type {
  TransitStop,
  TransitSubStop,
  TransitDeparture,
  TransitDeparturesResult,
  TransitItinerary,
  TransitItineraryLeg,
  TransitPlanResult,
} from "@reissulla/shared";
import { config } from "../config.js";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { tryCache } from "../utils/resilience.js";

const ROUTING_URL_FINLAND =
  "https://api.digitransit.fi/routing/v2/finland/gtfs/v1";
const ROUTING_URL_HSL =
  "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1";
const FETCH_TIMEOUT_MS = 10_000;

const STOPS_CACHE_TTL = 3600;
const DEPARTURES_CACHE_TTL = 60;
const PLAN_CACHE_TTL = 300;
const GEOCODE_CACHE_TTL = 86400;

const KNOWN_MODES = new Set(["BUS", "TRAM", "RAIL", "SUBWAY", "FERRY"]);

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

function apiKeyHeaders(): Record<string, string> {
  return config.digitransitApiKey
    ? { "digitransit-subscription-key": config.digitransitApiKey }
    : {};
}

function routingUrlForId(gtfsId: string): string {
  return gtfsId.startsWith("HSL:") ? ROUTING_URL_HSL : ROUTING_URL_FINLAND;
}

async function digitransitGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  url = ROUTING_URL_FINLAND,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...apiKeyHeaders(),
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

const GEOCODING_URL = "https://api.digitransit.fi/geocoding/v1/reverse";

async function reverseGeocodeCity(
  lat: number,
  lon: number,
): Promise<string | undefined> {
  const rLat = lat.toFixed(3);
  const rLon = lon.toFixed(3);
  const key = `transit:geocode:${rLat}:${rLon}`;

  const cached = await tryCache(() => cacheGet<string>(key));
  if (cached) return cached;

  try {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set("point.lat", rLat);
    url.searchParams.set("point.lon", rLon);
    url.searchParams.set("size", "1");

    const res = await fetch(url, {
      headers: apiKeyHeaders(),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return undefined;

    const json = await res.json();
    const city: string | undefined =
      json?.features?.[0]?.properties?.locality ??
      json?.features?.[0]?.properties?.name;

    if (city) {
      await tryCache(() => cacheSet(key, city, GEOCODE_CACHE_TTL));
    }
    return city;
  } catch {
    return undefined;
  }
}

async function enrichStopsWithCity(stops: TransitStop[]): Promise<void> {
  const coordToStops = new Map<string, TransitStop[]>();
  for (const stop of stops) {
    const coordKey = `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`;
    const list = coordToStops.get(coordKey) ?? [];
    list.push(stop);
    coordToStops.set(coordKey, list);
  }

  await Promise.all(
    Array.from(coordToStops.entries()).map(async ([, group]) => {
      const city = await reverseGeocodeCity(group[0]!.lat, group[0]!.lon);
      if (city) {
        for (const stop of group) {
          stop.city = city;
        }
      }
    }),
  );
}

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
        gtfsId
        name
        code
        platformCode
        vehicleMode
      }
    }
  }
`;

interface StationChildStop {
  gtfsId: string;
  name: string;
  code: string | null;
  platformCode: string | null;
  vehicleMode: string | null;
}

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
    stops: StationChildStop[];
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

interface GroupedEntry {
  stop: TransitStop;
  subStops: Map<string, TransitSubStop>; // keyed by gtfsId to deduplicate
}

/**
 * Group stops and stations by normalized name AND vehicle mode.
 * Each (name, mode) pair becomes one search result entry.
 * Stations are split into separate entries per child-stop mode.
 */
function groupStopsByNameAndMode(
  stops: SearchStopsAndStationsData["stops"],
  stations: SearchStopsAndStationsData["stations"],
): TransitStop[] {
  const grouped = new Map<string, GroupedEntry>();

  for (const st of stations) {
    const normalizedName = normalizeStopName(st.name);

    const childrenByMode = new Map<string, StationChildStop[]>();
    for (const child of st.stops) {
      const mode = child.vehicleMode ?? "UNKNOWN";
      const list = childrenByMode.get(mode) ?? [];
      list.push(child);
      childrenByMode.set(mode, list);
    }

    if (childrenByMode.size === 0 && st.vehicleMode) {
      const key = `${normalizedName}|${st.vehicleMode}`;
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
            vehicleModes: [st.vehicleMode],
          },
          subStops: new Map(),
        });
      }
    }

    for (const [mode, children] of childrenByMode) {
      const key = `${normalizedName}|${mode}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = {
          stop: {
            gtfsId: st.gtfsId,
            name: st.name,
            code: null,
            lat: st.lat,
            lon: st.lon,
            vehicleMode: mode,
            platformCode: null,
            isStation: true,
            vehicleModes: [mode],
          },
          subStops: new Map(),
        };
        grouped.set(key, entry);
      }
      for (const child of children) {
        entry.subStops.set(child.gtfsId, {
          gtfsId: child.gtfsId,
          code: child.code,
          platformCode: child.platformCode,
          vehicleMode: child.vehicleMode,
        });
      }
    }
  }

  for (const s of stops) {
    const mode = s.vehicleMode ?? "UNKNOWN";
    const key = `${normalizeStopName(s.name)}|${mode}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        stop: {
          gtfsId: s.gtfsId,
          name: s.name,
          code: s.code,
          lat: s.lat,
          lon: s.lon,
          vehicleMode: s.vehicleMode,
          platformCode: s.platformCode,
          isStation: false,
          vehicleModes: [mode],
        },
        subStops: new Map(),
      };
      grouped.set(key, entry);
    }
    entry.subStops.set(s.gtfsId, {
      gtfsId: s.gtfsId,
      code: s.code,
      platformCode: s.platformCode,
      vehicleMode: s.vehicleMode,
    });
  }

  return Array.from(grouped.values()).map(({ stop, subStops }) => ({
    ...stop,
    subStops: Array.from(subStops.values()),
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

  const grouped = groupStopsByNameAndMode(raw.stops, raw.stations);

  const data = grouped.filter(
    (s) => s.vehicleMode !== null && KNOWN_MODES.has(s.vehicleMode),
  );

  await enrichStopsWithCity(data);

  await tryCache(() => cacheSet(key, data, STOPS_CACHE_TTL));
  return { data, cached: false };
}

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
        stop {
          gtfsId
          platformCode
          code
        }
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
    stopId: st.stop?.gtfsId,
    platformCode: st.stop?.platformCode ?? st.stop?.code ?? null,
  }));
}

export async function getStopDepartures(
  stopId: string,
  count = 20,
  isStation = false,
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const key = `transit:departures:${stopId}:${count}:${isStation}`;
  const cached = await tryCache(
    () => cacheGet<TransitDeparturesResult>(key),
  );
  if (cached) return { data: cached, cached: true };

  let stopName: string | null = null;
  let stoptimes: StoptimeData[] = [];

  const url = routingUrlForId(stopId);

  if (isStation) {
    const raw = await digitransitGraphQL<StationDeparturesData>(
      STATION_DEPARTURES_QUERY,
      { id: stopId, n: count },
      url,
    );
    if (raw.station) {
      stopName = raw.station.name;
      stoptimes = raw.station.stoptimesWithoutPatterns;
    }
  } else {
    const raw = await digitransitGraphQL<StopDeparturesData>(
      STOP_DEPARTURES_QUERY,
      { id: stopId, n: count },
      url,
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

const MAX_PARALLEL_STOP_QUERIES = 10;

export async function getMultiStopDepartures(
  stopIds: string[],
  subStops: TransitSubStop[],
  countPerStop = 10,
  totalCount = 40,
  stationId?: string,
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const sortedIds = [...stopIds].sort();
  const key = `transit:departures-multi:${sortedIds.join(",")}:${countPerStop}:${totalCount}`;
  const cached = await tryCache(
    () => cacheGet<TransitDeparturesResult>(key),
  );
  if (cached) return { data: cached, cached: true };

  const subStopMap = new Map<string, TransitSubStop>();
  for (const ss of subStops) {
    subStopMap.set(ss.gtfsId, ss);
  }

  let allDepartures: TransitDeparture[] = [];
  let stopName: string | null = null;

  for (let i = 0; i < sortedIds.length; i += MAX_PARALLEL_STOP_QUERIES) {
    const batch = sortedIds.slice(i, i + MAX_PARALLEL_STOP_QUERIES);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const raw = await digitransitGraphQL<StopDeparturesData>(
            STOP_DEPARTURES_QUERY,
            { id, n: countPerStop },
            routingUrlForId(id),
          );
          return { id, data: raw.stop };
        } catch {
          return { id, data: null };
        }
      }),
    );

    for (const result of results) {
      if (!result.data) continue;
      if (!stopName) stopName = result.data.name;
      const meta = subStopMap.get(result.id);
      const deps = mapStoptimes(result.data.stoptimesWithoutPatterns);
      for (const dep of deps) {
        dep.stopId = dep.stopId ?? result.id;
        dep.platformCode = dep.platformCode ?? meta?.platformCode ?? meta?.code ?? null;
      }
      allDepartures.push(...deps);
    }
  }

  // Some stops (e.g. train platforms) only return data via the station-level query
  if (allDepartures.length === 0 && stationId) {
    try {
      const raw = await digitransitGraphQL<StationDeparturesData>(
        STATION_DEPARTURES_QUERY,
        { id: stationId, n: totalCount },
        routingUrlForId(stationId),
      );
      if (raw.station) {
        stopName = raw.station.name;
        const deps = mapStoptimes(raw.station.stoptimesWithoutPatterns);
        const subStopIdSet = new Set(sortedIds);
        for (const dep of deps) {
          if (dep.stopId && subStopIdSet.has(dep.stopId)) {
            allDepartures.push(dep);
          }
        }
        if (allDepartures.length === 0) {
          allDepartures = deps;
        }
      }
    } catch {
      // Station query also failed — fall through to "not found"
    }
  }

  if (!stopName) {
    const data: TransitDeparturesResult = {
      stopName: null,
      departures: [],
      subStops,
      message: "Stop not found or outside transit coverage area",
    };
    return { data, cached: false };
  }

  allDepartures.sort(
    (a, b) =>
      a.serviceDay + a.realtimeDeparture -
      (b.serviceDay + b.realtimeDeparture),
  );
  allDepartures = allDepartures.slice(0, totalCount);

  const data: TransitDeparturesResult = {
    stopName,
    departures: allDepartures,
    subStops,
  };

  await tryCache(() => cacheSet(key, data, DEPARTURES_CACHE_TTL));
  return { data, cached: false };
}

// CoordinateValue is a custom scalar in OTP2 — cannot use Float variables.
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
      duration: Math.round((node.endTime - node.startTime) / 1000),
      walkDistance: node.walkDistance,
      transfers: node.numberOfTransfers,
      legs,
    };
  });

  const data: TransitPlanResult = { itineraries };
  await tryCache(() => cacheSet(key, data, PLAN_CACHE_TTL));
  return { data, cached: false };
}
