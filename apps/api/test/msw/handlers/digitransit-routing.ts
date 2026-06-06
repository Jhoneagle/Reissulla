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
  type GraphName,
  type NearestErrorMarker,
  type NearestFixture,
} from "@reissulla/test-fixtures/external/digitransit-routing/index.js";
import { recordRequest } from "../request-log.js";

interface GraphQLBody {
  query: string;
  variables?: Record<string, unknown>;
}

/**
 * Extracts the GraphQL top-level operation name. The Reissulla client
 * doesn't send the `operationName` field — MSW falls back to parsing
 * the document text. Every operation in the codebase is named (we
 * named `PlanConnection` explicitly so this fallback works for it too).
 */
function extractOperationName(query: string): string | null {
  const m = query.match(/^\s*(?:query|mutation)\s+(\w+)/);
  return m?.[1] ?? null;
}

/** Anonymous-query escape hatch — only used by digitransit-client.test.ts. */
function detectSynthetic(query: string): boolean {
  return /^\s*\{\s*q\s*\}/.test(query);
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
  if (isNearestErrorMarker(entry)) {
    return entry as NearestErrorMarker;
  }
  return { kind: "json", body: entry as NearestFixture };
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
    case "Alerts":
      return { kind: "json", body: alertsByGraph[graph] };
    case "Feeds":
      return { kind: "json", body: feedsByGraph[graph] };
    case "CanceledTrips":
      return { kind: "json", body: canceledTrips };
    case "PlanConnection":
      return { kind: "json", body: emptyPlanConnection };
    case "SearchStopsAndStations":
    case "StopDepartures":
    case "StationDepartures":
    case "Patterns":
    case "Pattern":
    case "StopsByRadius":
    case "StoptimesForDate":
    case "TripsForDate":
    case "Agency":
    case "ServiceTimeRange":
      // Operations exercised by tests that still drive their own fetch
      // mocks; once those tests migrate, fixture registries will land here.
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

/**
 * The synthetic URLs used by digitransit-client.test.ts. Each path drives
 * a distinct transport-level scenario.
 */
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
    // Resolve only when the request signal aborts. Lets the test
    // controller.abort() trigger the rejection path.
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

/** Re-exported so tests can target the synthetic base. */
export const SYNTHETIC_ROUTING_BASE = SYNTHETIC_BASE;
