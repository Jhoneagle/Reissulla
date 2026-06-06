import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DEFAULT_PERSONA, serializePersona } from "@reissulla/shared";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import type { FastifyInstance } from "fastify";
import {
  getCapturedRequests,
  clearCapturedRequests,
} from "../../test/msw/request-log.js";

const DEFAULT_PERSONA_FINGERPRINT = serializePersona(DEFAULT_PERSONA);

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

function planRequestBody() {
  const planRequests = getCapturedRequests().filter((r) => {
    if (!r.url.includes("routing/v2")) return false;
    const body = r.body as { query?: string } | null;
    return body?.query?.includes("planConnection") ?? false;
  });
  if (planRequests.length === 0) {
    throw new Error("No planConnection request was captured");
  }
  return (planRequests.at(-1)!.body as { query: string }).query;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("Transit routes - input validation", () => {
  it("GET /transit/stops returns 400 when lat/lon missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/stops returns 400 for out-of-range lat", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=91&lon=24",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/stops returns 400 for invalid radius", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94&radius=5000",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/stops/search returns 400 when q missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/stops/search returns 400 for empty q", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search?q=",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/departures returns 400 when stopId missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/departures",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/plan returns 400 when coordinates missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/plan returns 400 for non-numeric coordinates", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=abc&fromLon=24&toLat=60.2&toLon=24.96",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/departures/multi returns 400 for non-array subStops", async () => {
    const res = await server.inject({
      method: "GET",
      url: '/api/v1/transit/departures/multi?stopIds=HSL:1040602&subStops={"bad":"data"}',
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /transit/departures/multi returns 400 for invalid subStops JSON", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/departures/multi?stopIds=HSL:1040602&subStops=not-json",
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Nearby stops
// ---------------------------------------------------------------------------

describe("GET /api/v1/transit/stops", () => {
  beforeEach(async () => {
    await cacheDel("transit:stops-nearby:v1:60.170:24.940:500");
    await cacheDel("transit:stops-nearby:v1:60.550:24.550:500");
    clearCapturedRequests();
  });

  it("returns nearby stops for Helsinki", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].gtfsId).toBe("HSL:1040602");
    expect(body.data[0].name).toBe("Rautatientori");
    expect(body.data[0].distance).toBe(120);
    expect(body.cached).toBe(false);
  });

  it("serves cached response on second call", async () => {
    await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
    });
    const firstCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
    });

    expect(
      getCapturedRequests().filter((r) => r.url.includes("routing/v2")).length,
    ).toBe(firstCount);
    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    // (60.55, 24.55) is wired to network-error in the nearest fixture.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.55&lon=24.55",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("TRANSIT_UNAVAILABLE");
  });
});

// ---------------------------------------------------------------------------
// Search stops
// ---------------------------------------------------------------------------

describe("GET /api/v1/transit/stops/search", () => {
  beforeEach(async () => {
    await cacheDel("transit:stops-search:v1:rautatientori");
    await cacheDel("transit:stops-search:v1:rautatientori-error");
  });

  it("returns stops matching query", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search?q=Rautatientori",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    const subway = body.data.find(
      (d: { vehicleMode: string }) => d.vehicleMode === "SUBWAY",
    );
    const bus = body.data.find(
      (d: { vehicleMode: string }) => d.vehicleMode === "BUS",
    );
    expect(subway).toBeDefined();
    expect(subway.name).toBe("Rautatientori");
    expect(subway.isStation).toBe(true);
    expect(subway.vehicleModes).toEqual(["SUBWAY"]);
    expect(subway.subStops).toHaveLength(1);
    expect(bus).toBeDefined();
    expect(bus.name).toBe("Rautatientori");
    expect(bus.subStops).toHaveLength(1);
    expect(body.cached).toBe(false);
  });

  it("returns 502 when Digitransit is down", async () => {
    // "Rautatientori-error" → HSL graph returns HTTP 503 in the fixture.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search?q=Rautatientori-error",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("TRANSIT_UNAVAILABLE");
  });
});

// ---------------------------------------------------------------------------
// Departures
// ---------------------------------------------------------------------------

describe("GET /api/v1/transit/departures", () => {
  beforeEach(async () => {
    await cacheDel("transit:departures:v2:HSL:1040602:20:false");
    await cacheDel("transit:departures:v2:UNKNOWN:9999:20:false");
    await cacheDel("transit:departures:v2:HSL:1040602-network-error:20:false");
  });

  it("returns departures for a valid stop", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/departures?stopId=HSL:1040602",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stopName).toBe("Rautatientori");
    expect(body.data.departures).toHaveLength(2);
    expect(body.data.departures[0].routeShortName).toBe("550");
    expect(body.data.departures[0].realtime).toBe(true);
    expect(body.data.departures[1].vehicleMode).toBe("TRAM");
    expect(body.data.message).toBeUndefined();
  });

  it("returns 200 with message when stop not found", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/departures?stopId=UNKNOWN:9999",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.departures).toHaveLength(0);
    expect(body.data.stopName).toBeNull();
    expect(body.data.message).toContain("not found");
  });

  it("returns 502 when Digitransit is down", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/departures?stopId=HSL:1040602-network-error",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("TRANSIT_UNAVAILABLE");
  });
});

// ---------------------------------------------------------------------------
// Route planning
// ---------------------------------------------------------------------------

describe("GET /api/v1/transit/plan", () => {
  beforeEach(async () => {
    await cacheDel(
      `transit:plan:v2:60.170:24.940:60.200:24.960:${DEFAULT_PERSONA_FINGERPRINT}`,
    );
    await cacheDel(
      `transit:plan:v2:60.180:24.940:60.200:24.960:${DEFAULT_PERSONA_FINGERPRINT}`,
    );
    await cacheDel(
      `transit:plan:v2:60.190:24.940:60.200:24.960:${DEFAULT_PERSONA_FINGERPRINT}`,
    );
    clearCapturedRequests();
  });

  it("returns itineraries for valid from/to", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.itineraries).toHaveLength(1);
    expect(body.data.itineraries[0].transfers).toBe(0);
    expect(body.data.itineraries[0].legs).toHaveLength(2);
    expect(body.data.itineraries[0].legs[0].mode).toBe("WALK");
    expect(body.data.itineraries[0].legs[1].mode).toBe("BUS");
    expect(body.data.itineraries[0].legs[1].route.shortName).toBe("550");
    expect(body.data.message).toBeUndefined();
  });

  it("returns 200 with message when no routes found", async () => {
    // (60.18, 24.94) → (60.20, 24.96) is wired to empty edges.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.18&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.itineraries).toHaveLength(0);
    expect(body.data.message).toContain("No transit routes");
  });

  it("serves cached plan on second call", async () => {
    await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });
    const firstCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(
      getCapturedRequests().filter((r) => r.url.includes("routing/v2")).length,
    ).toBe(firstCount);
    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    // (60.19, 24.94) → wired to HTTP 500.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.19&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("TRANSIT_UNAVAILABLE");
  });

  it("forwards wheelchair=1 persona into the GraphQL preferences arg", async () => {
    const wheelchairPersonaKey = `transit:plan:v2:60.170:24.940:60.200:24.960:wheelchair=1;lowFloor=0;noStairs=0;stroller=0;sr=0;lv=0;lang=en`;
    await cacheDel(wheelchairPersonaKey);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
      headers: {
        "x-reissulla-persona":
          "wheelchair=1;lowFloor=0;noStairs=0;stroller=0;sr=0;lv=0;lang=en",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(planRequestBody()).toContain("wheelchair: { enabled: true }");

    await cacheDel(wheelchairPersonaKey);
  });

  it("omits the preferences arg when persona has no accessibility flags", async () => {
    await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(planRequestBody()).not.toContain("preferences:");
  });

  it("uses a separate cache entry for wheelchair persona", async () => {
    const wheelchairKey = `transit:plan:v2:60.170:24.940:60.200:24.960:wheelchair=1;lowFloor=0;noStairs=0;stroller=0;sr=0;lv=0;lang=en`;
    await cacheDel(wheelchairKey);
    clearCapturedRequests();

    // Anonymous (default persona) — uses the default-persona cache slot.
    await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    // Wheelchair persona — must NOT hit the anonymous cache slot.
    await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
      headers: {
        "x-reissulla-persona":
          "wheelchair=1;lowFloor=0;noStairs=0;stroller=0;sr=0;lv=0;lang=en",
      },
    });

    // Exactly two upstream planConnection hits — once per persona cache slot.
    const planCalls = getCapturedRequests().filter((r) => {
      if (!r.url.includes("routing/v2")) return false;
      const body = r.body as { query?: string } | null;
      return body?.query?.includes("planConnection") ?? false;
    });
    expect(planCalls.length).toBe(2);

    await cacheDel(wheelchairKey);
  });
});
