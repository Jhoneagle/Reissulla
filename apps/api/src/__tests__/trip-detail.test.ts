import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import { getTripDetail } from "../services/transit/trip-detail.service.js";
import { getServiceNoteForTrip } from "../services/transit/frequency.service.js";
import { DEFAULT_PERSONA } from "@reissulla/shared";
import { digitransitRouting } from "@reissulla/test-fixtures";
import {
  getCapturedRequests,
  clearCapturedRequests,
} from "../../test/msw/request-log.js";

const { TRIP_DETAIL_SCENARIO } = digitransitRouting;

// Default trip = the canonical 550 weekday fixture. Tests that exercise
// a variant (empty activeDates, shuffled stoptimes, etc.) query a
// scenario-specific trip id instead.
const TRIP_ID = TRIP_DETAIL_SCENARIO.DEFAULT;

function utcSeconds(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number = 0,
): number {
  return Math.floor(Date.UTC(year, monthIndex, day, hour, minute, 0) / 1000);
}

// 2026-05-20 (Wed) 14:00 Europe/Helsinki (EEST) = 11:00 UTC.
const NOW_AFTERNOON = utcSeconds(2026, 4, 20, 11, 0);
// 2026-05-21 (Thu) 02:00 Europe/Helsinki (EEST) = 23:00 UTC May 20.
const NOW_HELSINKI_0200 = utcSeconds(2026, 4, 20, 23, 0);
// 2026-03-29 (DST spring-forward Sunday) 14:00 EEST = 11:00 UTC.
const NOW_DST = utcSeconds(2026, 2, 29, 11, 0);

const WEEKDAY_ACTIVE_DATES = [
  "20260518",
  "20260519",
  "20260520",
  "20260521",
  "20260522",
];

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
  for (const id of Object.values(TRIP_DETAIL_SCENARIO)) {
    await cacheDel(cacheKey("transit", "trip", 1, id));
  }
  await cacheDel(cacheKey("transit", "trip", 1, "HSL:nonexistent"));
  clearCapturedRequests();
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
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent("HSL:nonexistent")}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("TRIP_NOT_FOUND");
  });

  it("returns 404 with TRIP_INACTIVE when activeDates is empty", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_DETAIL_SCENARIO.INACTIVE)}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("TRIP_INACTIVE");
  });

  it("routes HSL-prefixed tripIds to the HSL adapter", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });

    expect(res.statusCode).toBe(200);
    const tripCalls = getCapturedRequests().filter((r) => {
      if (!r.url.includes("routing/v2")) return false;
      const body = r.body as { query?: string } | null;
      return body?.query?.includes("query Trip") ?? false;
    });
    expect(tripCalls.length).toBeGreaterThanOrEqual(1);
    expect(tripCalls[0]!.url).toBe(
      "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1",
    );
  });
});

describe("GET /api/v1/transit/trip/:tripId — caching & cache sharing", () => {
  it("serves a cached response on the second call", async () => {
    const first = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().cached).toBe(false);
    const firstCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;

    const second = await server.inject({
      method: "GET",
      url: `/api/v1/transit/trip/${encodeURIComponent(TRIP_ID)}`,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().cached).toBe(true);
    expect(
      getCapturedRequests().filter((r) => r.url.includes("routing/v2")).length,
    ).toBe(firstCount);
  });

  it("shares the cache with getServiceNoteForTrip — one fetch total", async () => {
    // Frequency service pre-warms the cache (sparse-board click-through).
    const note = await getServiceNoteForTrip(TRIP_ID, DEFAULT_PERSONA);
    expect(note).toBe("Arkisin");
    const callsAfterPrewarm = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;
    expect(callsAfterPrewarm).toBe(1);

    // Trip-detail call reuses the cached blob — no second upstream hit.
    const { data, cached } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(cached).toBe(true);
    expect(data.route.shortName).toBe("550");
    expect(
      getCapturedRequests().filter((r) => r.url.includes("routing/v2")).length,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Service-level mapping
// ---------------------------------------------------------------------------

describe("getTripDetail — RawTrip → TripDetail mapping", () => {
  it("resolves stoptime offsets to absolute unix epochs via the anchor date", async () => {
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
    const { data } = await getTripDetail(
      TRIP_ID,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    expect(data.stops[0]!.departureDelay).toBe(60); // Kamppi: 1min late
    expect(data.stops[2]!.departureDelay).toBe(-60); // Itäkeskus: 1min early
  });

  it("derives canBoard / canAlight from pickup / dropoff type", async () => {
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
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.STOPTIMES_SHUFFLED,
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
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.DIRECTION_NULL,
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
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.ACTIVE_TODAY_MIDDLE,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.serviceDate).toBe("20260520");
  });

  it("picks tomorrow when today is absent but tomorrow is present", async () => {
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.ACTIVE_TOMORROW,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.serviceDate).toBe("20260521");
  });

  it("picks the most recent past date when only past dates are available", async () => {
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.ACTIVE_PAST_ONLY,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );
    expect(data.serviceDate).toBe("20260518");
  });

  it("respects the service-day rollover at 02:00 Helsinki", async () => {
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.ACTIVE_ROLLOVER,
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
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.CROSS_MIDNIGHT,
      DEFAULT_PERSONA,
      NOW_AFTERNOON,
    );

    // 01:30 EEST on 2026-05-21 = 22:30 UTC May 20.
    expect(data.stops[3]!.scheduledArrival).toBe(
      utcSeconds(2026, 4, 20, 22, 30),
    );
  });

  it("resolves stoptimes on a DST spring-forward service day", async () => {
    const { data } = await getTripDetail(
      TRIP_DETAIL_SCENARIO.DST,
      DEFAULT_PERSONA,
      NOW_DST,
    );

    expect(data.serviceDate).toBe("20260329");
    // 14:32 EEST on 2026-03-29 = 11:32 UTC.
    expect(data.stops[0]!.scheduledDeparture).toBe(
      utcSeconds(2026, 2, 29, 11, 32),
    );
  });
});
