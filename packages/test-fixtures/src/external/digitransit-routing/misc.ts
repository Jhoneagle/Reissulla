import type { GraphName } from "./index.js";

/**
 * Catch-all fixtures for operations not yet covered by a dedicated
 * registry: Alerts, Feeds, CanceledTrips, plus an empty default for any
 * operation a unit test exercises without asserting on the body shape.
 */

export const canceledTrips = { data: { canceledTrips: [] } };

export const alertsByGraph: Record<GraphName, unknown> = {
  hsl: { data: { alerts: [] } },
  finland: { data: { alerts: [] } },
  varely: { data: { alerts: [] } },
  waltti: { data: { alerts: [] } },
};

export const feedsByGraph: Record<GraphName, unknown> = {
  hsl: { data: { feeds: [{ feedId: "HSL" }] } },
  finland: { data: { feeds: [{ feedId: "HSL" }, { feedId: "tampere" }] } },
  varely: { data: { feeds: [{ feedId: "varely" }] } },
  waltti: { data: { feeds: [{ feedId: "tampere" }] } },
};

/** Empty plan-connection response — the persona-per-adapter suite only
 *  asserts on the OUTGOING query body, never on the upstream response. */
export const emptyPlanConnection = { data: { planConnection: { edges: [] } } };

/** Empty response used when an operation has no specific fixture. */
export const emptyData = { data: null };
