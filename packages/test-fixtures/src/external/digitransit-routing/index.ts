/**
 * Digitransit Routing (OTP2 GraphQL) fixtures.
 *
 * Each registry is keyed by a stable upstream identifier — GTFS id for
 * trips/routes/stops/patterns, lat/lon bucket for nearest, search query
 * string for search-stops / search-routes. Fan-out registries
 * (nearest, search-*) are nested by graph so the fixture topology
 * mirrors the production fan-out one-to-one. An empty fixture for a
 * graph IS meaningful: it asserts the graph was queried and returned
 * nothing.
 */

export type GraphName = "hsl" | "finland" | "varely" | "waltti";

export const GRAPH_URL_TO_NAME: Record<string, GraphName> = {
  "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1": "hsl",
  "https://api.digitransit.fi/routing/v2/finland/gtfs/v1": "finland",
  "https://api.digitransit.fi/routing/v2/varely/gtfs/v1": "varely",
  "https://api.digitransit.fi/routing/v2/waltti/gtfs/v1": "waltti",
};

export * from "./trips.js";
export * from "./routes.js";
export * from "./line-departures.js";
export * from "./search-routes.js";
export * from "./nearest.js";
export * from "./stops-search.js";
export * from "./stop-departures.js";
export * from "./plan.js";
export * from "./misc.js";
