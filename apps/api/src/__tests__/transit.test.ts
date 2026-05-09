import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import type { FastifyInstance } from "fastify";

// -- Mock data matching Digitransit OTP2 GraphQL response shapes ----------

const mockNearbyStopsResponse = {
  data: {
    nearest: {
      edges: [
        {
          node: {
            distance: 120,
            place: {
              gtfsId: "HSL:1040602",
              name: "Rautatientori",
              code: "0612",
              lat: 60.1709,
              lon: 24.9432,
              vehicleMode: "BUS",
              platformCode: null,
            },
          },
        },
        {
          node: {
            distance: 250,
            place: {
              gtfsId: "HSL:1040601",
              name: "Rautatientori",
              code: "0611",
              lat: 60.1705,
              lon: 24.9428,
              vehicleMode: "TRAM",
              platformCode: "1",
            },
          },
        },
      ],
    },
  },
};

const mockSearchStopsResponse = {
  data: {
    stops: [
      {
        gtfsId: "HSL:1040602",
        name: "Rautatientori",
        code: "0612",
        lat: 60.1709,
        lon: 24.9432,
        vehicleMode: "BUS",
        platformCode: null,
      },
    ],
    stations: [
      {
        gtfsId: "HSL:1000003",
        name: "Rautatientori",
        lat: 60.171,
        lon: 24.9435,
        vehicleMode: "SUBWAY",
        stops: [
          {
            gtfsId: "HSL:1000003_1",
            name: "Rautatientori",
            code: "M112",
            platformCode: "1",
            vehicleMode: "SUBWAY",
          },
        ],
      },
    ],
  },
};

const mockDeparturesResponse = {
  data: {
    stop: {
      name: "Rautatientori",
      stoptimesWithoutPatterns: [
        {
          scheduledDeparture: 43200,
          realtimeDeparture: 43230,
          departureDelay: 30,
          realtime: true,
          serviceDay: 1778101200,
          headsign: "Westendinasema",
          trip: {
            route: {
              shortName: "550",
              longName: "Itäkeskus-Westendinasema",
              mode: "BUS",
            },
          },
        },
        {
          scheduledDeparture: 43500,
          realtimeDeparture: 43500,
          departureDelay: 0,
          realtime: false,
          serviceDay: 1778101200,
          headsign: "Kamppi",
          trip: {
            route: {
              shortName: "14",
              longName: "Hernesaari-Kamppi",
              mode: "TRAM",
            },
          },
        },
      ],
    },
  },
};

const mockDeparturesNullStopResponse = {
  data: { stop: null },
};

const mockPlanResponse = {
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

const mockPlanEmptyResponse = {
  data: { planConnection: { edges: [] } },
};

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

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
    await cacheDel("transit:stops-nearby:60.170:24.940:500");
    vi.restoreAllMocks();
  });

  it("returns nearby stops for Helsinki", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockNearbyStopsResponse), { status: 200 }),
    );

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
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockNearbyStopsResponse), { status: 200 }),
      );

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
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
    await cacheDel("transit:stops-search:rautatientori");
    vi.restoreAllMocks();
  });

  it("returns stops matching query", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSearchStopsResponse), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search?q=Rautatientori",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    // Results are split by mode — one for SUBWAY (station), one for BUS (stop)
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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search?q=Rautatientori",
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
    await cacheDel("transit:departures:HSL:1040602:20:false");
    vi.restoreAllMocks();
  });

  it("returns departures for a valid stop", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockDeparturesResponse), { status: 200 }),
    );

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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockDeparturesNullStopResponse), {
        status: 200,
      }),
    );

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
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/departures?stopId=HSL:1040602",
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
    await cacheDel("transit:plan:60.170:24.940:60.200:24.960");
    vi.restoreAllMocks();
  });

  it("returns itineraries for valid from/to", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPlanResponse), { status: 200 }),
    );

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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPlanEmptyResponse), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.itineraries).toHaveLength(0);
    expect(body.data.message).toContain("No transit routes");
  });

  it("serves cached plan on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockPlanResponse), { status: 200 }),
      );

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/plan?fromLat=60.17&fromLon=24.94&toLat=60.20&toLon=24.96",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("TRANSIT_UNAVAILABLE");
  });
});
