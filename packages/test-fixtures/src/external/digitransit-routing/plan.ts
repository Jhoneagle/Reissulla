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

/**
 * Cross-region HEL → TPE plan fixture. Four-leg trip mirroring real OTP2
 * output: WALK to Rautatientori → HSL commuter to Pasila → 9-min wait at
 * Pasila platform → VR Intercity to Tampere central station → WALK to
 * destination. Coords land in three distinct 0.01° buckets (Helsinki
 * origin, Pasila, Tampere) so the trip-weather composer's dedup story
 * exercises a realistic fan-out.
 *
 * Timestamps anchor at 2026-05-05T07:00 UTC (10:00 Helsinki summer time)
 * so the dashboard fixture's hourly forecast (which starts at 09:00
 * Helsinki) covers every leg.
 */
const HEL_TPE_START_MS = Date.UTC(2026, 4, 5, 9, 0, 0); // 12:00 Helsinki summer

const helsinkiToTampereePlan: PlanFixture = {
  data: {
    planConnection: {
      edges: [
        {
          node: {
            startTime: HEL_TPE_START_MS,
            endTime: HEL_TPE_START_MS + 165 * 60_000,
            numberOfTransfers: 1,
            walkDistance: 700,
            legs: [
              {
                mode: "WALK",
                startTime: HEL_TPE_START_MS,
                endTime: HEL_TPE_START_MS + 5 * 60_000,
                duration: 300,
                distance: 350,
                from: { name: "Origin", lat: 60.17, lon: 24.94, stop: null },
                to: {
                  name: "Helsinki",
                  lat: 60.17,
                  lon: 24.94,
                  stop: { gtfsId: "HSL:1020600", code: "0070" },
                },
                route: null,
                intermediateStops: null,
              },
              {
                mode: "RAIL",
                startTime: HEL_TPE_START_MS + 10 * 60_000,
                endTime: HEL_TPE_START_MS + 16 * 60_000,
                duration: 360,
                distance: 4200,
                from: {
                  name: "Helsinki",
                  lat: 60.17,
                  lon: 24.94,
                  stop: { gtfsId: "HSL:1020600", code: "0070" },
                },
                to: {
                  name: "Pasila",
                  lat: 60.2,
                  lon: 24.93,
                  stop: { gtfsId: "HSL:1174552", code: "0050" },
                },
                route: { shortName: "P", longName: "Helsinki - Vantaankoski" },
                intermediateStops: null,
              },
              {
                mode: "RAIL",
                startTime: HEL_TPE_START_MS + 25 * 60_000,
                endTime: HEL_TPE_START_MS + 130 * 60_000,
                duration: 6300,
                distance: 165_000,
                from: {
                  name: "Pasila",
                  lat: 60.2,
                  lon: 24.93,
                  stop: { gtfsId: "HSL:1174552", code: "0050" },
                },
                to: {
                  name: "Tampere",
                  lat: 61.5,
                  lon: 23.79,
                  stop: { gtfsId: "tampere:R001", code: null },
                },
                route: { shortName: "IC", longName: "Helsinki - Oulu" },
                intermediateStops: [
                  { name: "Tikkurila", gtfsId: "HSL:9091600" },
                  { name: "Hämeenlinna", gtfsId: "tampere:R031" },
                ],
              },
              {
                mode: "WALK",
                startTime: HEL_TPE_START_MS + 130 * 60_000,
                endTime: HEL_TPE_START_MS + 165 * 60_000,
                duration: 2100,
                distance: 350,
                from: {
                  name: "Tampere",
                  lat: 61.5,
                  lon: 23.79,
                  stop: { gtfsId: "tampere:R001", code: null },
                },
                to: {
                  name: "Destination",
                  lat: 61.5,
                  lon: 23.79,
                  stop: null,
                },
                route: null,
                intermediateStops: null,
              },
            ],
          },
        },
      ],
    },
  },
};

/**
 * Anchor every plan-fixture timestamp on the same wall-clock moment so the
 * weather composer can match it against the dashboard's `2026-05-05`
 * forecast fixture. Constructed via Date.UTC so the calendar date is
 * obvious at the call site instead of being a hand-rolled Unix-ms guess.
 */
const HELSINKI_PLAN_START_MS = Date.UTC(2026, 4, 5, 9, 0, 0); // 12:00 Helsinki summer

const helsinkiPlan: PlanFixture = {
  data: {
    planConnection: {
      edges: [
        {
          node: {
            startTime: HELSINKI_PLAN_START_MS,
            endTime: HELSINKI_PLAN_START_MS + 30 * 60_000,
            numberOfTransfers: 0,
            walkDistance: 450,
            legs: [
              {
                mode: "WALK",
                startTime: HELSINKI_PLAN_START_MS,
                endTime: HELSINKI_PLAN_START_MS + 5 * 60_000,
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
                startTime: HELSINKI_PLAN_START_MS + 5 * 60_000,
                endTime: HELSINKI_PLAN_START_MS + 25 * 60_000,
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
  // Cross-region: Helsinki city centre → Tampere (Hervanta-side).
  [planKey(60.17, 24.94, 61.5, 23.79)]: helsinkiToTampereePlan,
};

export const planEmpty: PlanFixture = empty;
export const planCoordsKey = planKey;
