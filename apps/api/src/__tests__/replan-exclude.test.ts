import { describe, it, expect } from "vitest";
import { planConnectionOperation } from "../adapters/digitransit-routing/operations/planConnection.js";
import type { GraphQLClient } from "../adapters/digitransit-routing/client.js";
import type { AdapterContext } from "../adapters/types.js";
import type { PlanConnectionArgs } from "../adapters/digitransit-routing/types.js";

/**
 * The disruption-driven re-plan bans routes via an OTP2
 * `preferences.transit.filters[].exclude` selector. These assertions pin that
 * the banned route gtfsIds reach the GraphQL document — without it, OTP2 would
 * happily re-suggest the disrupted route.
 */

function ctx(): AdapterContext {
  return { signal: new AbortController().signal, locale: "fi" };
}

function captureClient(): { client: GraphQLClient; query: () => string } {
  let captured = "";
  const client = {
    graphql: async <T>(q: string): Promise<T> => {
      captured = q;
      return { planConnection: { edges: [] } } as T;
    },
  } as unknown as GraphQLClient;
  return { client, query: () => captured };
}

const BASE: PlanConnectionArgs = {
  fromLat: 60.17,
  fromLon: 24.94,
  toLat: 60.2,
  toLon: 24.96,
  numItineraries: 3,
};

describe("planConnection — excludeRoutes", () => {
  it("emits a transit exclude filter carrying every banned route id", async () => {
    const { client, query } = captureClient();
    await planConnectionOperation(
      client,
      { ...BASE, excludeRoutes: ["HSL:1014", "HSL:2550"] },
      ctx(),
    );
    const q = query();
    expect(q).toMatch(/transit:\s*\{\s*filters/);
    expect(q).toContain("exclude");
    expect(q).toContain('"HSL:1014"');
    expect(q).toContain('"HSL:2550"');
  });

  it("omits the filter entirely when no routes are excluded", async () => {
    const { client, query } = captureClient();
    await planConnectionOperation(client, BASE, ctx());
    expect(query()).not.toContain("exclude");
  });

  it("omits the filter for an empty exclude list", async () => {
    const { client, query } = captureClient();
    await planConnectionOperation(
      client,
      { ...BASE, excludeRoutes: [] },
      ctx(),
    );
    expect(query()).not.toContain("exclude");
  });
});
