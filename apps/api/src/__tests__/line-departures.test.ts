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

// Pattern with two stops on line HSL:1550. The departures endpoint runs
// one routeLineDeparturesOperation that returns next-departures grouped
// by pattern at each stop in a single round-trip.
const PATTERN_CODE = "HSL:1550:0:01";

const lineFixture = {
  data: {
    route: {
      gtfsId: "HSL:1550",
      shortName: "550",
      longName: "Itäkeskus - Westendinasema",
      mode: "BUS",
      color: null,
      textColor: null,
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: PATTERN_CODE,
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

// Mirrors RawRouteLineDeparturesData. Each pattern-stop carries stoptimes
// already scoped to this route's patterns by the upstream filter, so the
// fixture only has to express the next stoptimes for HSL:1550.
function lineDeparturesPayload(opts: {
  stopAStoptimes: Array<Partial<Stoptime>>;
  stopBStoptimes: Array<Partial<Stoptime>>;
}) {
  return {
    data: {
      route: {
        patterns: [
          {
            code: PATTERN_CODE,
            directionId: 0,
            stops: [
              {
                gtfsId: "HSL:STOP_A",
                stoptimesForPatterns: [
                  {
                    pattern: { code: PATTERN_CODE },
                    stoptimes: opts.stopAStoptimes.map(fillStoptime),
                  },
                ],
              },
              {
                gtfsId: "HSL:STOP_B",
                stoptimesForPatterns: [
                  {
                    pattern: { code: PATTERN_CODE },
                    stoptimes: opts.stopBStoptimes.map(fillStoptime),
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

interface Stoptime {
  scheduledDeparture: number;
  realtimeDeparture: number;
  departureDelay: number;
  realtime: boolean;
  serviceDay: number;
  trip: { gtfsId: string };
}

function fillStoptime(over: Partial<Stoptime>): Stoptime {
  return {
    scheduledDeparture: 43000,
    realtimeDeparture: 43000,
    departureDelay: 0,
    realtime: false,
    serviceDay: 1778100000,
    trip: { gtfsId: "HSL:1550:trip:default" },
    ...over,
  };
}

function mockLineThenDepartures(
  departuresPayload: ReturnType<typeof lineDeparturesPayload>,
) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementationOnce(
      async () => new Response(JSON.stringify(lineFixture), { status: 200 }),
    )
    .mockImplementation(
      async () =>
        new Response(JSON.stringify(departuresPayload), { status: 200 }),
    );
}

async function clearCaches() {
  await cacheDel("transit:line:v1:HSL:1550");
  await cacheDel("transit:line-departures:v2:HSL:1550:any");
  await cacheDel("transit:line-departures:v2:HSL:1550:0");
}

describe("GET /api/v1/transit/lines/:gtfsId/departures", () => {
  beforeEach(async () => {
    await clearCaches();
    vi.restoreAllMocks();
  });

  it("returns one row per pattern stop with the next departure for the line", async () => {
    mockLineThenDepartures(
      lineDeparturesPayload({
        stopAStoptimes: [
          {
            scheduledDeparture: 43000,
            realtimeDeparture: 43030,
            departureDelay: 30,
            realtime: true,
            trip: { gtfsId: "HSL:1550:trip:1" },
          },
          { scheduledDeparture: 43500, realtimeDeparture: 43500 },
          { scheduledDeparture: 44000, realtimeDeparture: 44000 },
        ],
        stopBStoptimes: [
          { scheduledDeparture: 43800, realtimeDeparture: 43800 },
        ],
      }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1550/departures?direction=0",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].stop.gtfsId).toBe("HSL:STOP_A");
    expect(body.data[1].stop.gtfsId).toBe("HSL:STOP_B");
    expect(body.data[0].nextDepartureUnix).toBe(1778100000 + 43030);
    expect(body.data[0].realtime).toBe(true);
    expect(body.data[0].delaySec).toBe(30);
  });

  it("returns null fields when a stop has no upcoming line departures", async () => {
    mockLineThenDepartures(
      lineDeparturesPayload({
        stopAStoptimes: [],
        stopBStoptimes: [
          { scheduledDeparture: 43800, realtimeDeparture: 43800 },
        ],
      }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1550/departures?direction=0",
    });

    const body = res.json();
    expect(body.data[0].nextDepartureUnix).toBeNull();
    expect(body.data[0].scheduledDepartureUnix).toBeNull();
    expect(body.data[0].delaySec).toBe(0);
    expect(body.data[0].realtime).toBe(false);
    // The second stop still produces a real row from the same single
    // upstream response — proves the projection isn't all-or-nothing.
    expect(body.data[1].nextDepartureUnix).toBe(1778100000 + 43800);
  });

  it("caches the resulting per-line projection", async () => {
    const fetchSpy = mockLineThenDepartures(
      lineDeparturesPayload({
        stopAStoptimes: [
          { scheduledDeparture: 43000, realtimeDeparture: 43030 },
        ],
        stopBStoptimes: [
          { scheduledDeparture: 43800, realtimeDeparture: 43800 },
        ],
      }),
    );

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1550/departures?direction=0",
    });
    const callsAfterFirst = fetchSpy.mock.calls.length;

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1550/departures?direction=0",
    });
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
    expect(res.json().cached).toBe(true);
  });

  it("picks the chronologically earliest stoptime even when upstream returns them out of order", async () => {
    // OTP's stoptimesForPatterns is observed to return stoptimes in
    // pattern order, not chronological — the projection must sort.
    mockLineThenDepartures(
      lineDeparturesPayload({
        stopAStoptimes: [
          { scheduledDeparture: 50000, realtimeDeparture: 50000 },
          { scheduledDeparture: 43000, realtimeDeparture: 43000 },
          { scheduledDeparture: 47000, realtimeDeparture: 47000 },
        ],
        stopBStoptimes: [
          { scheduledDeparture: 43800, realtimeDeparture: 43800 },
        ],
      }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1550/departures?direction=0",
    });

    const body = res.json();
    expect(body.data[0].nextDepartureUnix).toBe(1778100000 + 43000);
  });

  it("issues exactly one departures fetch regardless of stop count", async () => {
    const fetchSpy = mockLineThenDepartures(
      lineDeparturesPayload({
        stopAStoptimes: [
          { scheduledDeparture: 43000, realtimeDeparture: 43000 },
        ],
        stopBStoptimes: [
          { scheduledDeparture: 43800, realtimeDeparture: 43800 },
        ],
      }),
    );

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1550/departures?direction=0",
    });

    // Exactly two upstream hits: getLine (route + patterns) plus the
    // single line-departures call. The pre-rewrite fan-out would have
    // produced 1 + N stop calls for an N-stop pattern.
    expect(fetchSpy.mock.calls.length).toBe(2);
  });
});
