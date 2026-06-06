/**
 * PlanConnection — keyed by stringified `from→to` coordinate tuple.
 * Drives the /api/v1/transit/plan route tests.
 *
 * The persona-per-adapter and transit.test.ts wheelchair-persona tests
 * assert on the OUTGOING GraphQL body, not on the upstream response. The
 * shared request-log buffer covers that.
 */

export type PlanErrorMarker = { kind: "http-error"; status: number };

export type PlanFixture = {
  data: {
    planConnection: {
      edges: unknown[];
    };
  };
};

export type PlanRegistryEntry = PlanFixture | PlanErrorMarker;

export function isPlanErrorMarker(v: PlanRegistryEntry): v is PlanErrorMarker {
  return "kind" in v;
}

const helsinkiPlan: PlanFixture = {
  data: {
    planConnection: {
      edges: [
        {
          node: {
            startTime: 1778166000000,
            endTime: 1778167800000,
            numberOfTransfers: 0,
            walkDistance: 450,
            legs: [
              {
                mode: "WALK",
                startTime: 1778166000000,
                endTime: 1778166300000,
                duration: 300,
                distance: 250,
                from: { name: "Origin", lat: 60.17, lon: 24.94, stop: null },
                to: {
                  name: "Rautatientori",
                  lat: 60.1709,
                  lon: 24.9432,
                  stop: { gtfsId: "HSL:1040602", code: "0612" },
                },
                route: null,
                intermediateStops: null,
              },
              {
                mode: "BUS",
                startTime: 1778166300000,
                endTime: 1778167500000,
                duration: 1200,
                distance: 5000,
                from: {
                  name: "Rautatientori",
                  lat: 60.1709,
                  lon: 24.9432,
                  stop: { gtfsId: "HSL:1040602", code: "0612" },
                },
                to: {
                  name: "Destination",
                  lat: 60.2,
                  lon: 24.96,
                  stop: { gtfsId: "HSL:2040601", code: "2041" },
                },
                route: {
                  shortName: "550",
                  longName: "Itäkeskus-Westendinasema",
                },
                intermediateStops: [
                  { name: "Hakaniemi", gtfsId: "HSL:1050601" },
                ],
              },
            ],
          },
        },
      ],
    },
  },
};

const empty: PlanFixture = { data: { planConnection: { edges: [] } } };

function planKey(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): string {
  return `${fromLat.toFixed(2)},${fromLon.toFixed(2)}→${toLat.toFixed(2)},${toLon.toFixed(2)}`;
}

export const planByCoords: Record<string, PlanRegistryEntry> = {
  [planKey(60.17, 24.94, 60.2, 24.96)]: helsinkiPlan,
  [planKey(60.18, 24.94, 60.2, 24.96)]: empty,
  [planKey(60.19, 24.94, 60.2, 24.96)]: { kind: "http-error", status: 500 },
};

export const planEmpty: PlanFixture = empty;
export const planCoordsKey = planKey;
