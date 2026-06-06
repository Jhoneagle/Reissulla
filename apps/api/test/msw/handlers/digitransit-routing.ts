import { HttpResponse, http } from "msw";
import {
  GRAPH_URL_TO_NAME,
  tripsByGtfsId,
  tripNotFound,
  routesByGtfsId,
  routeNotFound,
  lineDeparturesByGtfsId,
  searchRoutesByGraphAndQuery,
  searchRoutesEmpty,
  canceledTrips,
  alertsByGraph,
  feedsByGraph,
  emptyPlanConnection,
  emptyData,
  nearestByGraphAndCoord,
  nearestEmpty,
  nearestCoordKey,
  isNearestErrorMarker,
  stopsSearchByGraphAndName,
  stopsSearchEmpty,
  normalizeStopsSearchName,
  isStopsSearchErrorMarker,
  stopDeparturesByGtfsId,
  stopDeparturesEmpty,
  isStopDeparturesErrorMarker,
  planByCoords,
  planEmpty,
  planCoordsKey,
  isPlanErrorMarker,
  type GraphName,
  type NearestFixture,
  type StopsSearchFixture,
  type StopDeparturesFixture,
  type PlanFixture,
} from "@reissulla/test-fixtures/external/digitransit-routing/index.js";
import { recordRequest } from "../request-log.js";

interface GraphQLBody {
  query: string;
  variables?: Record<string, unknown>;
}

function extractOperationName(query: string): string | null {
  const m = query.match(/^\s*(?:query|mutation)\s+(\w+)/);
  return m?.[1] ?? null;
}

/** Anonymous-query escape hatch — only used by digitransit-client.test.ts. */
function detectSynthetic(query: string): boolean {
  return /^\s*\{\s*q\s*\}/.test(query);
}

/**
 * planConnection inlines its coordinates in the query string (the OTP2
 * CoordinateValue scalar can't take Float variables). Extract them so we
 * can dispatch on the coordinate tuple.
 */
function extractPlanCoords(query: string): {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
} | null {
  const originMatch = query.match(
    /origin:\s*\{\s*location:\s*\{\s*coordinate:\s*\{\s*latitude:\s*([-\d.]+),\s*longitude:\s*([-\d.]+)/,
  );
  const destMatch = query.match(
    /destination:\s*\{\s*location:\s*\{\s*coordinate:\s*\{\s*latitude:\s*([-\d.]+),\s*longitude:\s*([-\d.]+)/,
  );
  if (!originMatch || !destMatch) return null;
  return {
    fromLat: Number(originMatch[1]),
    fromLon: Number(originMatch[2]),
    toLat: Number(destMatch[1]),
    toLon: Number(destMatch[2]),
  };
}

type DispatchResult =
  | { kind: "json"; body: unknown }
  | { kind: "http-error"; status: number }
  | { kind: "network-error" };

function nearestFor(graph: GraphName, body: GraphQLBody): DispatchResult {
  const lat = Number(body.variables?.lat);
  const lon = Number(body.variables?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { kind: "json", body: nearestEmpty };
  }
  const key = nearestCoordKey(lat, lon);
  const entry = nearestByGraphAndCoord[graph][key];
  if (!entry) return { kind: "json", body: nearestEmpty };
  if (isNearestErrorMarker(entry)) return entry;
  return { kind: "json", body: entry as NearestFixture };
}

function searchStopsFor(graph: GraphName, body: GraphQLBody): DispatchResult {
  const name = body.variables?.name as string | undefined;
  if (!name) return { kind: "json", body: stopsSearchEmpty };
  const key = normalizeStopsSearchName(name);
  const entry = stopsSearchByGraphAndName[graph][key];
  if (!entry) return { kind: "json", body: stopsSearchEmpty };
  if (isStopsSearchErrorMarker(entry)) return entry;
  return { kind: "json", body: entry as StopsSearchFixture };
}

function stopDeparturesFor(body: GraphQLBody): DispatchResult {
  const id = body.variables?.id as string | undefined;
  if (!id) return { kind: "json", body: stopDeparturesEmpty };
  const entry = stopDeparturesByGtfsId[id];
  if (!entry) return { kind: "json", body: stopDeparturesEmpty };
  if (isStopDeparturesErrorMarker(entry)) return entry;
  return { kind: "json", body: entry as StopDeparturesFixture };
}

function planFor(body: GraphQLBody): DispatchResult {
  const coords = extractPlanCoords(body.query);
  if (!coords) return { kind: "json", body: emptyPlanConnection };
  const key = planCoordsKey(
    coords.fromLat,
    coords.fromLon,
    coords.toLat,
    coords.toLon,
  );
  const entry = planByCoords[key];
  if (!entry) return { kind: "json", body: planEmpty };
  if (isPlanErrorMarker(entry)) return entry;
  return { kind: "json", body: entry as PlanFixture };
}

function dispatchRouting(graph: GraphName, body: GraphQLBody): DispatchResult {
  if (detectSynthetic(body.query)) {
    return { kind: "json", body: { data: { ok: true } } };
  }

  const opName = extractOperationName(body.query);

  switch (opName) {
    case "Trip": {
      const id = body.variables?.id as string | undefined;
      if (!id) return { kind: "json", body: tripNotFound };
      return { kind: "json", body: tripsByGtfsId[id] ?? tripNotFound };
    }
    case "RouteWithPatterns":
    case "Route": {
      const id = body.variables?.id as string | undefined;
      if (!id) return { kind: "json", body: routeNotFound };
      return { kind: "json", body: routesByGtfsId[id] ?? routeNotFound };
    }
    case "RouteLineDepartures": {
      const id = body.variables?.routeId as string | undefined;
      if (!id) return { kind: "json", body: { data: { route: null } } };
      return {
        kind: "json",
        body: lineDeparturesByGtfsId[id] ?? { data: { route: null } },
      };
    }
    case "Routes": {
      const name = body.variables?.name as string | undefined;
      if (!name) return { kind: "json", body: searchRoutesEmpty };
      return {
        kind: "json",
        body: searchRoutesByGraphAndQuery[graph][name] ?? searchRoutesEmpty,
      };
    }
    case "NearbyStops":
      return nearestFor(graph, body);
    case "SearchStopsAndStations":
      return searchStopsFor(graph, body);
    case "StopDepartures":
    case "StationDepartures":
      return stopDeparturesFor(body);
    case "PlanConnection":
      return planFor(body);
    case "Alerts":
      return { kind: "json", body: alertsByGraph[graph] };
    case "Feeds":
      return { kind: "json", body: feedsByGraph[graph] };
    case "CanceledTrips":
      return { kind: "json", body: canceledTrips };
    case "StoptimesForDate":
      // Operation maps null stop → empty array; return that shape so the
      // line-frequency service doesn't crash on a missing data envelope.
      return { kind: "json", body: { data: { stop: null } } };
    case "Patterns":
    case "Pattern":
    case "StopsByRadius":
    case "TripsForDate":
    case "Agency":
    case "ServiceTimeRange":
      return { kind: "json", body: emptyData };
    default:
      throw new Error(
        `digitransit-routing MSW handler — unknown operation "${opName}" for graph "${graph}". Add a case or a registry entry.`,
      );
  }
}

function makeGraphHandler(graphUrl: string) {
  const graph = GRAPH_URL_TO_NAME[graphUrl];
  if (!graph) throw new Error(`Unknown routing graph URL: ${graphUrl}`);

  return http.post(graphUrl, async ({ request }) => {
    const body = (await request.json()) as GraphQLBody;
    recordRequest({
      url: request.url,
      method: request.method,
      body,
      headers: Object.fromEntries(request.headers.entries()),
    });
    const result = dispatchRouting(graph, body);
    if (result.kind === "http-error") {
      return new HttpResponse(`Mock error ${result.status}`, {
        status: result.status,
      });
    }
    if (result.kind === "network-error") {
      return HttpResponse.error();
    }
    return HttpResponse.json(result.body as Record<string, unknown>);
  });
}

const SYNTHETIC_BASE = "https://example.test";

const syntheticHandlers = [
  http.post(`${SYNTHETIC_BASE}/ok`, async ({ request }) => {
    recordRequest({
      url: request.url,
      method: request.method,
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
    });
    return HttpResponse.json({ data: { ok: true } });
  }),
  http.post(
    `${SYNTHETIC_BASE}/http-error`,
    async () =>
      new HttpResponse("oops", {
        status: 503,
        statusText: "Service Unavailable",
      }),
  ),
  http.post(`${SYNTHETIC_BASE}/graphql-error`, async () =>
    HttpResponse.json({ data: null, errors: [{ message: "Bad query" }] }),
  ),
  http.post(`${SYNTHETIC_BASE}/network-error`, async () =>
    HttpResponse.error(),
  ),
  http.post(`${SYNTHETIC_BASE}/abort`, async ({ request }) => {
    await new Promise<void>((_resolve, reject) => {
      request.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    return new HttpResponse(null);
  }),
];

export const digitransitRoutingHandlers = [
  ...Object.keys(GRAPH_URL_TO_NAME).map(makeGraphHandler),
  ...syntheticHandlers,
];

export const SYNTHETIC_ROUTING_BASE = SYNTHETIC_BASE;
