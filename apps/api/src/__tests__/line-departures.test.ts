import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";

let server: FastifyInstance;

beforeAll(async () => {
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

// Pattern with two stops on line HSL:1059. The departures endpoint will
// fan out one stopDepartures call per stop and filter by line gtfsId.
const lineFixture = {
  data: {
    route: {
      gtfsId: "HSL:1059",
      shortName: "550",
      longName: "Itäkeskus - Westendinasema",
      mode: "BUS",
      color: null,
      textColor: null,
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1059:0:01",
          headsign: "Westendinasema",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:STOP_A",
              name: "Itäkeskus",
              lat: 60.21,
              lon: 25.08,
              code: null,
              platformCode: null,
            },
            {
              gtfsId: "HSL:STOP_B",
              name: "Westendinasema",
              lat: 60.17,
              lon: 24.81,
              code: null,
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

// Each per-stop response carries departures from multiple lines so the
// filter (routeGtfsId === HSL:1059) is exercised.
function stopDeparturesFor(stopName: string) {
  return {
    data: {
      stop: {
        name: stopName,
        stoptimesWithoutPatterns: [
          {
            scheduledArrival: 43000,
            realtimeArrival: 43000,
            arrivalDelay: 0,
            scheduledDeparture: 43000,
            realtimeDeparture: 43030,
            departureDelay: 30,
            realtime: true,
            serviceDay: 1778100000,
            headsign: "Westendinasema",
            trip: {
              gtfsId: "HSL:1059:trip:1",
              route: {
                gtfsId: "HSL:1059",
                shortName: "550",
                longName: "Itäkeskus - Westendinasema",
                mode: "BUS",
              },
            },
          },
          {
            scheduledArrival: 43180,
            realtimeArrival: 43180,
            arrivalDelay: 0,
            scheduledDeparture: 43180,
            realtimeDeparture: 43180,
            departureDelay: 0,
            realtime: false,
            serviceDay: 1778100000,
            // Other line — must be filtered out.
            headsign: "Kamppi",
            trip: {
              gtfsId: "HSL:14:trip:5",
              route: {
                gtfsId: "HSL:14",
                shortName: "14",
                longName: "Itäkeskus - Kamppi",
                mode: "BUS",
              },
            },
          },
          {
            scheduledArrival: 43500,
            realtimeArrival: 43500,
            arrivalDelay: 0,
            scheduledDeparture: 43500,
            realtimeDeparture: 43500,
            departureDelay: 0,
            realtime: false,
            serviceDay: 1778100000,
            headsign: "Westendinasema",
            trip: {
              gtfsId: "HSL:1059:trip:2",
              route: {
                gtfsId: "HSL:1059",
                shortName: "550",
                longName: "Itäkeskus - Westendinasema",
                mode: "BUS",
              },
            },
          },
        ],
      },
    },
  };
}

function mockLineThenStops() {
  // First fetch → route lookup; subsequent fetches → per-stop departures.
  // The order matches the implementation (getLine → fan-out).
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementationOnce(
      async () => new Response(JSON.stringify(lineFixture), { status: 200 }),
    )
    .mockImplementation(
      async () =>
        new Response(JSON.stringify(stopDeparturesFor("Stop")), {
          status: 200,
        }),
    );
}

async function clearCaches() {
  await cacheDel("transit:line:v1:HSL:1059");
  await cacheDel("transit:line-departures:v1:HSL:1059:any");
  await cacheDel("transit:line-departures:v1:HSL:1059:0");
  await cacheDel("transit:departures:v2:HSL:STOP_A:20:false");
  await cacheDel("transit:departures:v2:HSL:STOP_B:20:false");
}

describe("GET /api/v1/transit/lines/:gtfsId/departures", () => {
  beforeEach(async () => {
    await clearCaches();
    vi.restoreAllMocks();
  });

  it("returns one row per pattern stop with the next departure for the line", async () => {
    mockLineThenStops();

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059/departures?direction=0",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].stop.gtfsId).toBe("HSL:STOP_A");
    expect(body.data[1].stop.gtfsId).toBe("HSL:STOP_B");
    // The filter must drop HSL:14 — the earliest 550 row has realtime
    // departure 43030 (the realtime'd 43000), not 43180 (HSL:14).
    expect(body.data[0].nextDepartureUnix).toBe(1778100000 + 43030);
    expect(body.data[0].realtime).toBe(true);
    expect(body.data[0].delaySec).toBe(30);
  });

  it("returns null fields when a stop has no upcoming line departures", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(
        async () => new Response(JSON.stringify(lineFixture), { status: 200 }),
      )
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                stop: {
                  name: "Stop",
                  stoptimesWithoutPatterns: [],
                },
              },
            }),
            { status: 200 },
          ),
      );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059/departures?direction=0",
    });

    const body = res.json();
    expect(body.data[0].nextDepartureUnix).toBeNull();
    expect(body.data[0].scheduledDepartureUnix).toBeNull();
    expect(body.data[0].delaySec).toBe(0);
    expect(body.data[0].realtime).toBe(false);
  });

  it("caches the resulting per-line projection", async () => {
    const fetchSpy = mockLineThenStops();

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059/departures?direction=0",
    });
    const callsAfterFirst = fetchSpy.mock.calls.length;

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059/departures?direction=0",
    });
    // Cached → no further upstream calls.
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
    expect(res.json().cached).toBe(true);
  });
});
