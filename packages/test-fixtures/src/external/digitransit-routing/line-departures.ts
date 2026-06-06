/**
 * RouteLineDepartures(routeId:) — used by the line-departures endpoint to
 * return one row per pattern stop with the next departure for the line.
 * Tests drive different shape variants by querying scenario-specific
 * route ids (HSL:1550-<scenario>). Each scenario id is also present in
 * `routesByGtfsId` so the upstream chain (route → departures) resolves
 * end-to-end.
 */

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

const PATTERN_CODE = "HSL:1550:0:01";

function buildLineDepartures(opts: {
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

export const LINE_DEPARTURES_SCENARIO = {
  DEFAULT: "HSL:1550",
  STOP_A_EMPTY: "HSL:1550-stopA-empty",
  OUT_OF_ORDER: "HSL:1550-out-of-order",
  CACHED: "HSL:1550-cached",
  SINGLE_FETCH: "HSL:1550-single-fetch",
} as const;

const hsl1550Default = buildLineDepartures({
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
  stopBStoptimes: [{ scheduledDeparture: 43800, realtimeDeparture: 43800 }],
});

const hsl1550StopAEmpty = buildLineDepartures({
  stopAStoptimes: [],
  stopBStoptimes: [{ scheduledDeparture: 43800, realtimeDeparture: 43800 }],
});

const hsl1550OutOfOrder = buildLineDepartures({
  stopAStoptimes: [
    { scheduledDeparture: 50000, realtimeDeparture: 50000 },
    { scheduledDeparture: 43000, realtimeDeparture: 43000 },
    { scheduledDeparture: 47000, realtimeDeparture: 47000 },
  ],
  stopBStoptimes: [{ scheduledDeparture: 43800, realtimeDeparture: 43800 }],
});

const hsl1550Simple = buildLineDepartures({
  stopAStoptimes: [{ scheduledDeparture: 43000, realtimeDeparture: 43030 }],
  stopBStoptimes: [{ scheduledDeparture: 43800, realtimeDeparture: 43800 }],
});

export const lineDeparturesByGtfsId: Record<string, unknown> = {
  [LINE_DEPARTURES_SCENARIO.DEFAULT]: hsl1550Default,
  [LINE_DEPARTURES_SCENARIO.STOP_A_EMPTY]: hsl1550StopAEmpty,
  [LINE_DEPARTURES_SCENARIO.OUT_OF_ORDER]: hsl1550OutOfOrder,
  [LINE_DEPARTURES_SCENARIO.CACHED]: hsl1550Simple,
  [LINE_DEPARTURES_SCENARIO.SINGLE_FETCH]: hsl1550Simple,
};

export const lineDeparturesBuilder = buildLineDepartures;
