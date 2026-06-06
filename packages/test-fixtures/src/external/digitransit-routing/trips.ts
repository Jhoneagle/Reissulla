import { TRIP_TRAM_4_MORNING } from "../../scenarios.js";

/**
 * Trip(id:) responses keyed by GTFS trip id. The `HSL:`/`tampere:`/etc.
 * prefix makes keys globally unique, so we don't need to also key by
 * graph — the request URL's graph picks the registry only as a sanity
 * check (a trip id is only ever queried against its owning graph).
 *
 * Scenarios used by trip-detail.test.ts are constructed from a single
 * base "550 bus" template; each scenario overrides one knob (active
 * dates, stoptime order, directionId, etc.) so the test can drive
 * deterministic upstream behaviour by querying a unique trip id.
 */

interface Stop {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
  code: string | null;
  platformCode: string | null;
}

interface Stoptime {
  stop: Stop;
  scheduledArrival: number;
  scheduledDeparture: number;
  realtimeArrival: number;
  realtimeDeparture: number;
  arrivalDelay: number;
  departureDelay: number;
  realtime: boolean;
  timepoint: boolean;
  stopPositionInPattern: number;
  pickupType: "SCHEDULED" | "NONE" | "CALL_AGENCY" | "COORDINATE_WITH_DRIVER";
  dropoffType: "SCHEDULED" | "NONE" | "CALL_AGENCY" | "COORDINATE_WITH_DRIVER";
}

interface Bus550Overrides {
  gtfsId?: string;
  activeDates?: string[];
  directionId?: string | null;
  stoptimes?: Stoptime[];
  appendStoptime?: Stoptime;
}

const KAMPPI: Stop = {
  gtfsId: "HSL:1040602",
  name: "Kamppi",
  lat: 60.169,
  lon: 24.932,
  code: "0612",
  platformCode: null,
};

const LASIPALATSI: Stop = {
  gtfsId: "HSL:1040610",
  name: "Lasipalatsi",
  lat: 60.17,
  lon: 24.935,
  code: "0613",
  platformCode: "3",
};

const ITAKESKUS: Stop = {
  gtfsId: "HSL:1040701",
  name: "Itäkeskus",
  lat: 60.21,
  lon: 25.078,
  code: "0701",
  platformCode: null,
};

const WEEKDAY_ACTIVE_DATES = [
  "20260518",
  "20260519",
  "20260520",
  "20260521",
  "20260522",
];

function baseStoptimes(): Stoptime[] {
  return [
    {
      stop: KAMPPI,
      scheduledArrival: 14 * 3600 + 30 * 60,
      scheduledDeparture: 14 * 3600 + 32 * 60,
      realtimeArrival: 14 * 3600 + 31 * 60,
      realtimeDeparture: 14 * 3600 + 33 * 60,
      arrivalDelay: 60,
      departureDelay: 60,
      realtime: true,
      timepoint: true,
      stopPositionInPattern: 0,
      pickupType: "SCHEDULED",
      dropoffType: "NONE",
    },
    {
      stop: LASIPALATSI,
      scheduledArrival: 14 * 3600 + 35 * 60,
      scheduledDeparture: 14 * 3600 + 35 * 60,
      realtimeArrival: 14 * 3600 + 35 * 60,
      realtimeDeparture: 14 * 3600 + 35 * 60,
      arrivalDelay: 0,
      departureDelay: 0,
      realtime: true,
      timepoint: false,
      stopPositionInPattern: 1,
      pickupType: "SCHEDULED",
      dropoffType: "SCHEDULED",
    },
    {
      stop: ITAKESKUS,
      scheduledArrival: 14 * 3600 + 58 * 60,
      scheduledDeparture: 15 * 3600 + 1 * 60,
      realtimeArrival: 14 * 3600 + 57 * 60,
      realtimeDeparture: 15 * 3600 + 0 * 60,
      arrivalDelay: -60,
      departureDelay: -60,
      realtime: true,
      timepoint: true,
      stopPositionInPattern: 2,
      pickupType: "NONE",
      dropoffType: "SCHEDULED",
    },
  ];
}

function makeBus550(overrides: Bus550Overrides = {}): unknown {
  const stoptimes = overrides.stoptimes ?? baseStoptimes();
  if (overrides.appendStoptime) stoptimes.push(overrides.appendStoptime);
  return {
    data: {
      trip: {
        gtfsId: overrides.gtfsId ?? "HSL:trip-bus-550-default",
        tripHeadsign: "Itäkeskus",
        directionId:
          overrides.directionId === undefined ? "0" : overrides.directionId,
        activeDates: overrides.activeDates ?? [...WEEKDAY_ACTIVE_DATES],
        route: {
          gtfsId: "HSL:1140",
          shortName: "550",
          longName: "Westendinasema — Itäkeskus",
          mode: "BUS",
          color: null,
          textColor: null,
          agency: {
            gtfsId: "HSL:HSL",
            name: "Helsingin seudun liikenne",
          },
        },
        stoptimes,
      },
    },
  };
}

/** Scenario ids referenced by trip-detail.test.ts. */
export const TRIP_DETAIL_SCENARIO = {
  DEFAULT: "HSL:trip-bus-550-default",
  INACTIVE: "HSL:trip-bus-550-inactive",
  DIRECTION_NULL: "HSL:trip-bus-550-direction-null",
  STOPTIMES_SHUFFLED: "HSL:trip-bus-550-stoptimes-shuffled",
  ACTIVE_TODAY_MIDDLE: "HSL:trip-bus-550-active-today-middle",
  ACTIVE_TOMORROW: "HSL:trip-bus-550-active-tomorrow",
  ACTIVE_PAST_ONLY: "HSL:trip-bus-550-active-past-only",
  ACTIVE_ROLLOVER: "HSL:trip-bus-550-active-rollover",
  CROSS_MIDNIGHT: "HSL:trip-bus-550-cross-midnight",
  DST: "HSL:trip-bus-550-dst",
} as const;

// Active dates: a window around 2026-05-20 so the e2e content test can
// anchor on the "today" service date regardless of when it runs in
// development. (Production-style refresh would regenerate these.)
const TRAM_4_ACTIVE_DATES = [
  "20260518",
  "20260519",
  "20260520",
  "20260521",
  "20260522",
  "20260523",
  "20260524",
];

const tripTram4Morning = {
  data: {
    trip: {
      gtfsId: TRIP_TRAM_4_MORNING.gtfsId,
      tripHeadsign: TRIP_TRAM_4_MORNING.headsign,
      directionId: "0",
      activeDates: TRAM_4_ACTIVE_DATES,
      route: {
        gtfsId: TRIP_TRAM_4_MORNING.routeGtfsId,
        shortName: TRIP_TRAM_4_MORNING.routeShortName,
        longName: "Katajanokka - Munkkiniemi",
        mode: "TRAM",
        color: "00985F",
        textColor: "FFFFFF",
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
      stoptimes: [
        {
          stop: {
            gtfsId: "HSL:1020452",
            name: "Rautatientori",
            lat: 60.1715,
            lon: 24.9412,
            code: "H0017",
            platformCode: null,
          },
          scheduledArrival: 27000,
          scheduledDeparture: 27000,
          realtimeArrival: 27000,
          realtimeDeparture: 27000,
          arrivalDelay: 0,
          departureDelay: 0,
          realtime: false,
          timepoint: true,
          stopPositionInPattern: 0,
          pickupType: "SCHEDULED",
          dropoffType: "NONE",
        },
        {
          stop: {
            gtfsId: "HSL:1040402",
            name: "Kauppatori",
            lat: 60.1683,
            lon: 24.9523,
            code: "H1027",
            platformCode: null,
          },
          scheduledArrival: 27240,
          scheduledDeparture: 27240,
          realtimeArrival: 27240,
          realtimeDeparture: 27240,
          arrivalDelay: 0,
          departureDelay: 0,
          realtime: false,
          timepoint: true,
          stopPositionInPattern: 1,
          pickupType: "NONE",
          dropoffType: "SCHEDULED",
        },
      ],
    },
  },
};

const tripWithCanceledStop = {
  data: {
    trip: {
      gtfsId: "HSL:4_22550_2410211146_canceled",
      tripHeadsign: TRIP_TRAM_4_MORNING.headsign,
      directionId: 0,
      serviceId: "HSL:1004_20251021_Ke",
      pattern: {
        code: "HSL:1004:0:01",
        headsign: TRIP_TRAM_4_MORNING.headsign,
      },
      route: {
        gtfsId: TRIP_TRAM_4_MORNING.routeGtfsId,
        shortName: TRIP_TRAM_4_MORNING.routeShortName,
        longName: "Katajanokka - Munkkiniemi",
        mode: "TRAM",
        color: "00985F",
        textColor: "FFFFFF",
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
      stoptimes: [
        {
          stop: {
            gtfsId: "HSL:1020452",
            name: "Rautatientori",
            code: "H0017",
            platformCode: null,
          },
          scheduledArrival: 27000,
          scheduledDeparture: 27000,
          realtimeArrival: null,
          realtimeDeparture: null,
          arrivalDelay: null,
          departureDelay: null,
          realtime: null,
          pickupType: "CANCELLED",
          dropoffType: "CANCELLED",
        },
      ],
    },
  },
};

const SHUFFLED = (): Stoptime[] => {
  const base = baseStoptimes();
  return [base[2]!, base[0]!, base[1]!];
};

const CROSS_MIDNIGHT_STOPTIME: Stoptime = {
  stop: {
    gtfsId: "HSL:1040999",
    name: "Yöterminaali",
    lat: 60.22,
    lon: 25.08,
    code: "0999",
    platformCode: null,
  },
  scheduledArrival: 25 * 3600 + 30 * 60,
  scheduledDeparture: 25 * 3600 + 30 * 60,
  realtimeArrival: 25 * 3600 + 30 * 60,
  realtimeDeparture: 25 * 3600 + 30 * 60,
  arrivalDelay: 0,
  departureDelay: 0,
  realtime: true,
  timepoint: true,
  stopPositionInPattern: 3,
  pickupType: "NONE",
  dropoffType: "SCHEDULED",
};

export const tripsByGtfsId: Record<string, unknown> = {
  [TRIP_TRAM_4_MORNING.gtfsId]: tripTram4Morning,
  "HSL:4_22550_2410211146_canceled": tripWithCanceledStop,

  [TRIP_DETAIL_SCENARIO.DEFAULT]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.DEFAULT,
  }),
  [TRIP_DETAIL_SCENARIO.INACTIVE]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.INACTIVE,
    activeDates: [],
  }),
  [TRIP_DETAIL_SCENARIO.DIRECTION_NULL]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.DIRECTION_NULL,
    directionId: null,
  }),
  [TRIP_DETAIL_SCENARIO.STOPTIMES_SHUFFLED]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.STOPTIMES_SHUFFLED,
    stoptimes: SHUFFLED(),
  }),
  [TRIP_DETAIL_SCENARIO.ACTIVE_TODAY_MIDDLE]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.ACTIVE_TODAY_MIDDLE,
    activeDates: ["20260517", "20260520", "20260523"],
  }),
  [TRIP_DETAIL_SCENARIO.ACTIVE_TOMORROW]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.ACTIVE_TOMORROW,
    activeDates: ["20260517", "20260521"],
  }),
  [TRIP_DETAIL_SCENARIO.ACTIVE_PAST_ONLY]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.ACTIVE_PAST_ONLY,
    activeDates: ["20260501", "20260515", "20260518"],
  }),
  [TRIP_DETAIL_SCENARIO.ACTIVE_ROLLOVER]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.ACTIVE_ROLLOVER,
    activeDates: ["20260519", "20260520", "20260521"],
  }),
  [TRIP_DETAIL_SCENARIO.CROSS_MIDNIGHT]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.CROSS_MIDNIGHT,
    appendStoptime: CROSS_MIDNIGHT_STOPTIME,
  }),
  [TRIP_DETAIL_SCENARIO.DST]: makeBus550({
    gtfsId: TRIP_DETAIL_SCENARIO.DST,
    activeDates: ["20260329"],
  }),
};

export const tripNotFound = { data: { trip: null } };
