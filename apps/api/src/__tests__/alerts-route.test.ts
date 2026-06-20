import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { FastifyInstance } from "fastify";
import { alertsByGraph } from "@reissulla/test-fixtures/external/digitransit-routing/index.js";
import type { Alert } from "@reissulla/shared";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

function seedHslAlert(): void {
  alertsByGraph.hsl = {
    data: {
      alerts: [
        {
          id: "HSL:alert:1",
          alertHeaderTextFi: "Linja 14 peruttu",
          alertHeaderTextEn: "Route 14 cancelled",
          alertDescriptionTextFi: "Linja 14 ei liikennöi.",
          alertDescriptionTextEn: "Route 14 is not running.",
          alertCause: "TECHNICAL_PROBLEM",
          alertEffect: "NO_SERVICE",
          alertSeverityLevel: "SEVERE",
          // Active now: started in the past, open-ended.
          effectiveStartDate: 1_600_000_000,
          effectiveEndDate: null,
          entities: [{ __typename: "Route", gtfsId: "HSL:1014" }],
        },
      ],
    },
  };
}

/** A scheduled alert whose window hasn't opened yet — must be filtered out. */
function seedFutureHslAlert(): void {
  alertsByGraph.hsl = {
    data: {
      alerts: [
        {
          id: "HSL:alert:future",
          alertHeaderTextFi: "Tuleva työmaa",
          alertHeaderTextEn: "Upcoming works",
          alertDescriptionTextFi: "Alkaa myöhemmin.",
          alertDescriptionTextEn: "Starts later.",
          alertCause: "CONSTRUCTION",
          alertEffect: "DETOUR",
          alertSeverityLevel: "WARNING",
          effectiveStartDate: Math.floor(Date.now() / 1000) + 86_400,
          effectiveEndDate: Math.floor(Date.now() / 1000) + 172_800,
          entities: [{ __typename: "Route", gtfsId: "HSL:1014" }],
        },
      ],
    },
  };
}

describe("GET /api/v1/alerts", () => {
  beforeEach(async () => {
    await cacheDel("alerts:active:v1:all");
    seedHslAlert();
  });

  afterEach(() => {
    alertsByGraph.hsl = { data: { alerts: [] } };
  });

  it("returns the composed active set including the transit alert", async () => {
    const res = await server.inject({ method: "GET", url: "/api/v1/alerts" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: Alert[]; cached: boolean };
    const route14 = body.data.find(
      (a) => a.scope.kind === "route" && a.scope.gtfsId === "HSL:1014",
    );
    expect(route14).toBeDefined();
    expect(route14).toMatchObject({
      source: "digitransit",
      severity: "severe",
      effect: "NO_SERVICE",
    });
  });

  it("filters to only intersecting alerts when routes is passed", async () => {
    const match = await server.inject({
      method: "GET",
      url: "/api/v1/alerts?routes=HSL:1014",
    });
    const matchBody = match.json() as { data: Alert[] };
    expect(matchBody.data.length).toBeGreaterThan(0);
    // Every returned alert is either the pinned route or a network-wide notice.
    for (const alert of matchBody.data) {
      const ok =
        alert.scope.kind === "global" ||
        (alert.scope.kind === "route" && alert.scope.gtfsId === "HSL:1014");
      expect(ok).toBe(true);
    }

    const miss = await server.inject({
      method: "GET",
      url: "/api/v1/alerts?routes=HSL:9999",
    });
    const missBody = miss.json() as { data: Alert[] };
    expect(
      missBody.data.some(
        (a) => a.scope.kind === "route" && a.scope.gtfsId === "HSL:1014",
      ),
    ).toBe(false);
  });

  it("serves the composed set from cache on the second call", async () => {
    const first = await server.inject({ method: "GET", url: "/api/v1/alerts" });
    expect((first.json() as { cached: boolean }).cached).toBe(false);
    const second = await server.inject({
      method: "GET",
      url: "/api/v1/alerts",
    });
    expect((second.json() as { cached: boolean }).cached).toBe(true);
  });

  it("excludes alerts whose effective window has not started", async () => {
    await cacheDel("alerts:active:v1:all");
    seedFutureHslAlert();
    const res = await server.inject({ method: "GET", url: "/api/v1/alerts" });
    const body = res.json() as { data: Alert[] };
    expect(
      body.data.some(
        (a) => a.scope.kind === "route" && a.scope.gtfsId === "HSL:1014",
      ),
    ).toBe(false);
  });
});
