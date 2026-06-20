import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import type { FastifyInstance } from "fastify";
import { alertsByGraph } from "@reissulla/test-fixtures/external/digitransit-routing/index.js";
import type { ReplanResult } from "@reissulla/shared";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";

/**
 * Integration coverage for the `reactToAlerts` opt-in on
 * `POST /api/v1/transit/plan`. The Helsinki plan fixture rides bus route
 * `HSL:2550`; seeding a NO_SERVICE alert on that route should surface a
 * `replanSuggestion`, while opting out (or an alert on an unrelated route)
 * leaves the wire unchanged for share-link consumers.
 */

let server: FastifyInstance;

const HEL_ORIGIN = { lat: 60.17, lon: 24.94 };
const HEL_DEST = { lat: 60.2, lon: 24.96 };
const RIDDEN_ROUTE = "HSL:2550";

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

async function flushCaches(): Promise<void> {
  const planKeys = await redis.keys("transit:plan:*");
  if (planKeys.length > 0) await Promise.all(planKeys.map((k) => cacheDel(k)));
  await cacheDel("alerts:active:v1:all");
}

function seedAlert(gtfsId: string, effect: string, severity = "SEVERE"): void {
  alertsByGraph.hsl = {
    data: {
      alerts: [
        {
          id: "HSL:alert:replan",
          alertHeaderTextFi: "Reitti poikki",
          alertHeaderTextEn: "Route blocked",
          alertDescriptionTextFi: "Linja ei liikennöi.",
          alertDescriptionTextEn: "The route is not running.",
          alertCause: "TECHNICAL_PROBLEM",
          alertEffect: effect,
          alertSeverityLevel: severity,
          effectiveStartDate: 1_600_000_000,
          effectiveEndDate: null,
          entities: [{ __typename: "Route", gtfsId }],
        },
      ],
    },
  };
}

beforeEach(async () => {
  await flushCaches();
});

afterEach(() => {
  alertsByGraph.hsl = { data: { alerts: [] } };
});

type PlanBody = {
  data: { itineraries: unknown[]; replanSuggestion?: ReplanResult };
};

describe("POST /api/v1/transit/plan — reactToAlerts", () => {
  it("attaches a replanSuggestion when a NO_SERVICE alert hits the route", async () => {
    seedAlert(RIDDEN_ROUTE, "NO_SERVICE");
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: HEL_DEST },
        numItineraries: 1,
        reactToAlerts: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as PlanBody;
    expect(body.data.replanSuggestion).toBeDefined();
    expect(body.data.replanSuggestion!.triggered).toBe(true);
    expect(body.data.replanSuggestion!.reason?.effect).toContain("NO_SERVICE");
    expect(
      body.data.replanSuggestion!.alternative?.itineraries.length,
    ).toBeGreaterThan(0);
  });

  it("omits replanSuggestion when reactToAlerts is not set", async () => {
    seedAlert(RIDDEN_ROUTE, "NO_SERVICE");
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: HEL_DEST },
        numItineraries: 1,
      },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as PlanBody).data.replanSuggestion).toBeUndefined();
  });

  it("omits replanSuggestion when the alert is on an unrelated route", async () => {
    seedAlert("HSL:9999", "NO_SERVICE");
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/transit/plan",
      payload: {
        query: { from: HEL_ORIGIN, to: HEL_DEST },
        numItineraries: 1,
        reactToAlerts: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as PlanBody).data.replanSuggestion).toBeUndefined();
  });
});
