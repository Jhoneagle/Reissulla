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
import { cacheKey } from "../cache/key.js";
import { getTripDetail } from "../services/transit/trip-detail.service.js";
import { getServiceNoteForTrip } from "../services/transit/frequency.service.js";
import { DEFAULT_PERSONA } from "@reissulla/shared";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function utcSeconds(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number = 0,
): number {
  return Math.floor(Date.UTC(year, monthIndex, day, hour, minute, 0) / 1000);
}

const TRIP_ID = "HSL:1140_20260520_Ke_2_0827";
const TRIP_CACHE_KEY = cacheKey("transit", "trip", 1, TRIP_ID);

// 2026-05-20 (Wed) 14:00 Europe/Helsinki (EEST) = 11:00 UTC.
const NOW_AFTERNOON = utcSeconds(2026, 4, 20, 11, 0);
// 2026-05-21 (Thu) 02:00 Europe/Helsinki (EEST) = 23:00 UTC May 20.
const NOW_HELSINKI_0200 = utcSeconds(2026, 4, 20, 23, 0);
// 2026-03-29 (DST spring-forward Sunday) 14:00 EEST = 11:00 UTC.
const NOW_DST = utcSeconds(2026, 2, 29, 11, 0);

// Mon–Fri of the week containing NOW_AFTERNOON. Weekday-only set so the
// frequency-derivation path returns "Arkisin", matching how this trip
// would appear in the wild.
const WEEKDAY_ACTIVE_DATES = [
  "20260518",
  "20260519",
  "20260520",
  "20260521",
  "20260522",
];

function makeRawTrip(overrides: Partial<RawTripFixture> = {}): RawTripFixture {
  return {
    gtfsId: TRIP_ID,
    tripHeadsign: "Itäkeskus",
    directionId: "0",
    activeDates: [...WEEKDAY_ACTIVE_DATES],
    route: {
      gtfsId: "HSL:1140",
      shortName: "550",
      longName: "Westendinasema — Itäkeskus",
      mode: "BUS",
      color: null,
      textColor: null,
      agency: { gtfsId: "HSL:HSL", name: "Helsingin seudun liikenne" },
    },
    stoptimes: [
      makeStoptime({
        stop: {
          gtfsId: "HSL:1040602",
          name: "Kamppi",
          lat: 60.169,
          lon: 24.932,
          code: "0612",
          platformCode: null,
        },
        scheduledArrival: 14 * 3600 + 30 * 60,
        scheduledDeparture: 14 * 3600 + 32 * 60,
        realtimeArrival: 14 * 3600 + 31 * 60,
        realtimeDeparture: 14 * 3600 + 33 * 60,
        arrivalDelay: 60,
        departureDelay: 60,
        realtime: true,
        timepoint: true,
        stopPositionInPattern: 0,
        // Origin terminus: boarding-only.
        pickupType: "SCHEDULED",
        dropoffType: "NONE",
      }),
      makeStoptime({
        stop: {
          gtfsId: "HSL:1040610",
          name: "Lasipalatsi",
          lat: 60.17,
          lon: 24.935,
          code: "0613",
          platformCode: "3",
        },
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
      }),
      makeStoptime({
        stop: {
          gtfsId: "HSL:1040701",
          name: "Itäkeskus",
          lat: 60.21,
          lon: 25.078,
          code: "0701",
          platformCode: null,
        },
        scheduledArrival: 14 * 3600 + 58 * 60,
        scheduledDeparture: 15 * 3600 + 1 * 60,
        realtimeArrival: 14 * 3600 + 57 * 60,
        realtimeDeparture: 15 * 3600 + 0 * 60,
        // Early by 60s.
        arrivalDelay: -60,
        departureDelay: -60,
        realtime: true,
        timepoint: true,
        stopPositionInPattern: 2,
        // Destination terminus: alighting-only.
        pickupType: "NONE",
        dropoffType: "SCHEDULED",
      }),
    ],
    ...overrides,
  };
}

interface RawTripFixture {
  gtfsId: string;
  tripHeadsign: string;
  directionId: string | null;
  activeDates: string[];
  route: {
    gtfsId: string;
    shortName: string;
    longName: string;
    mode: string;
    color: string | null;
    textColor: string | null;
    agency: { gtfsId: string; name: string } | null;
  };
  stoptimes: ReturnType<typeof makeStoptime>[];
}

function makeStoptime(over: {
  stop: {
    gtfsId: string;
    name: string;
    lat: number;
    lon: number;
    code: string | null;
    platformCode: string | null;
  };
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
}) {
  return over;
}

function mockTripResponse(trip: RawTripFixture | null) {
  return new Response(JSON.stringify({ data: { trip } }), { status: 200 });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  await cacheDel(TRIP_CACHE_KEY);
  await cacheDel(cacheKey("transit", "trip", 1, "HSL:nonexistent"));
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Route-level integration
// ---------------------------------------------------------------------------

describe("GET /api/v1/transit/trip/:tripId — validation & error envelope", () => {
  it("returns 400 when tripId is whitespace-only", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/trip/%20",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 with TRIP_NOT_FOUND when upstream resolves to null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockTripResponse(null));

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent("HSL:nonexistent")}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("TRIP_NOT_FOUND");
  });

  it("returns 404 with TRIP_INACTIVE when activeDates is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(makeRawTrip({ activeDates: [] })),
    );

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("TRIP_INACTIVE");
  });

  it("routes HSL-prefixed tripIds to the HSL adapter", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockTripResponse(makeRawTrip()));

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });

    expect(res.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toBe("https://api.digitransit.fi/routing/v2/hsl/gtfs/v1");
  });
});

describe("GET /api/v1/transit/trip/:tripId — caching & cache sharing", () => {
  it("serves a cached response on the second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockTripResponse(makeRawTrip()));

    const first = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const second = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().cached).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("shares the cache with getServiceNoteForTrip — one fetch total", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockTripResponse(makeRawTrip()));

    // Frequency service pre-warms the cache (sparse-board click-through).
    const note = await getServiceNoteForTrip(TRIP_ID, DEFAULT_PERSONA);
    expect(note).toBe("Arkisin");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Trip-detail call reuses the cached blob — no second upstream hit.
    const { data, cached } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(cached).toBe(true);
    expect(data.route.shortName).toBe("550");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Service-level mapping
// ---------------------------------------------------------------------------

describe("getTripDetail — RawTrip → TripDetail mapping", () => {
  it("resolves stoptime offsets to absolute unix epochs via the anchor date", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(makeRawTrip()),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    expect(data.serviceDate).toBe("20260520");
    expect(data.serviceDates).toEqual(WEEKDAY_ACTIVE_DATES);
    expect(data.pattern.headsign).toBe("Itäkeskus");
    expect(data.pattern.directionId).toBe(0);
    expect(data.route.mode).toBe("BUS");
    expect(data.agency.name).toBe("Helsingin seudun liikenne");
    expect(data.stops).toHaveLength(3);

    // 14:32 EEST on 2026-05-20 = 11:32 UTC.
    expect(data.stops[0]!.scheduledDeparture).toBe(
      utcSeconds(2026, 4, 20, 11, 32),
    );
    // realtimeDeparture = 14:33 EEST = 11:33 UTC.
    expect(data.stops[0]!.departureTime).toBe(utcSeconds(2026, 4, 20, 11, 33));
  });

  it("preserves delay sign (positive = late, negative = early)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(makeRawTrip()),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    expect(data.stops[0]!.departureDelay).toBe(60); // Kamppi: 1min late
    expect(data.stops[2]!.departureDelay).toBe(-60); // Itäkeskus: 1min early
  });

  it("derives canBoard / canAlight from pickup / dropoff type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(makeRawTrip()),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    // Origin terminus: boarding allowed, alighting blocked.
    expect(data.stops[0]!.canBoard).toBe(true);
    expect(data.stops[0]!.canAlight).toBe(false);
    // Through stop: both allowed.
    expect(data.stops[1]!.canBoard).toBe(true);
    expect(data.stops[1]!.canAlight).toBe(true);
    // Destination terminus: alighting allowed, boarding blocked.
    expect(data.stops[2]!.canBoard).toBe(false);
    expect(data.stops[2]!.canAlight).toBe(true);
  });

  it("sorts stoptimes by stopPositionInPattern even when upstream delivers them out of order", async () => {
    const trip = makeRawTrip();
    const shuffled = [
      trip.stoptimes[2]!,
      trip.stoptimes[0]!,
      trip.stoptimes[1]!,
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse({ ...trip, stoptimes: shuffled }),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    expect(data.stops.map((s) => s.stopPositionInPattern)).toEqual([0, 1, 2]);
    expect(data.stops.map((s) => s.name)).toEqual([
      "Kamppi",
      "Lasipalatsi",
      "Itäkeskus",
    ]);
  });

  it("maps directionId 'null' to a numeric null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(makeRawTrip({ directionId: null })),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.pattern.directionId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Anchor service-date selection
// ---------------------------------------------------------------------------

describe("getTripDetail — anchor service-date selection", () => {
  it("picks today when today's date is in activeDates", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(
        // Sun, Wed (today), Sat — today is the closest.
        makeRawTrip({ activeDates: ["20260517", "20260520", "20260523"] }),
      ),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.serviceDate).toBe("20260520");
  });

  it("picks tomorrow when today is absent but tomorrow is present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(
        // Sun and tomorrow (Thu) — tomorrow wins by distance.
        makeRawTrip({ activeDates: ["20260517", "20260521"] }),
      ),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.serviceDate).toBe("20260521");
  });

  it("picks the most recent past date when only past dates are available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(
        makeRawTrip({ activeDates: ["20260501", "20260515", "20260518"] }),
      ),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.serviceDate).toBe("20260518");
  });

  it("respects the service-day rollover at 02:00 Helsinki", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(
        makeRawTrip({ activeDates: ["20260519", "20260520", "20260521"] }),
      ),
    );

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_HELSINKI_0200,
    );
    // 02:00 wall clock is still on the 2026-05-20 service day per the
    // rollover convention, so the anchor stays on the 20th even though
    // the calendar already reads the 21st.
    expect(data.serviceDate).toBe("20260520");
  });
});

// ---------------------------------------------------------------------------
// Time-conversion edge cases
// ---------------------------------------------------------------------------

describe("getTripDetail — time-conversion edge cases", () => {
  it("resolves cross-midnight stoptimes (offset > 86400) to next-day epochs", async () => {
    // Append a 25:30 stop to simulate a late-night extension on the
    // 2026-05-20 service day.
    const trip = makeRawTrip();
    trip.stoptimes.push(
      makeStoptime({
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
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockTripResponse(trip));

    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    // 01:30 EEST on 2026-05-21 = 22:30 UTC May 20.
    expect(data.stops[3]!.scheduledArrival).toBe(
      utcSeconds(2026, 4, 20, 22, 30),
    );
  });

  it("resolves stoptimes on a DST spring-forward service day", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTripResponse(makeRawTrip({ activeDates: ["20260329"] })),
    );

    const { data } = await getTripDetail(TRIP_ID, DEFAULT_PERSONA, NOW_DST);

    expect(data.serviceDate).toBe("20260329");
    // 14:32 EEST on 2026-03-29 = 11:32 UTC.
    expect(data.stops[0]!.scheduledDeparture).toBe(
      utcSeconds(2026, 2, 29, 11, 32),
    );
  });
});
