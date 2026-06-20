import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import type { TransitItinerary, TransitItineraryLeg } from "@reissulla/shared";
import { db } from "../db/index.js";
import {
  tripLog,
  pinnedLines,
  pinnedStops,
  preferences,
  user,
} from "../db/schema.js";
import * as historyService from "../services/history.service.js";
import * as tripLogRepo from "../db/repositories/trip-log.repo.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";
import * as pinnedLinesRepo from "../db/repositories/pinned-lines.repo.js";

const TEST_USER_ID = "test-user-history-service";

function makeLeg(
  routeGtfsId: string,
  routeShort: string,
  stopGtfsId: string,
  stopName: string,
  mode = "BUS",
): TransitItineraryLeg {
  return {
    mode,
    startTime: 0,
    endTime: 0,
    duration: 0,
    distance: 0,
    from: {
      name: stopName,
      lat: 60.17,
      lon: 24.94,
      stop: { gtfsId: stopGtfsId, code: null },
    },
    to: { name: "Destination", lat: 60.2, lon: 24.96 },
    route: { gtfsId: routeGtfsId, shortName: routeShort, longName: "" },
  };
}

function makeItinerary(legs: TransitItineraryLeg[]): TransitItinerary {
  return {
    startTime: 0,
    endTime: 0,
    duration: 0,
    walkDistance: 0,
    transfers: 0,
    legs,
  };
}

function logInput(itinerary: TransitItinerary): historyService.LogTripInput {
  return {
    userId: TEST_USER_ID,
    from: { lat: 60.17, lon: 24.94, name: "Kamppi" },
    to: { lat: 60.2, lon: 24.96, name: "Pasila" },
    itinerary,
  };
}

async function setOptIn(enabled: boolean) {
  await preferencesRepo.upsert(TEST_USER_ID, { tripLogEnabled: enabled });
}

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-history-service@test.reissulla.local",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
  await db.delete(pinnedLines).where(eq(pinnedLines.userId, TEST_USER_ID));
  await db.delete(pinnedStops).where(eq(pinnedStops.userId, TEST_USER_ID));
  await db.delete(preferences).where(eq(preferences.userId, TEST_USER_ID));
});

describe("historyService.logIfEnabled", () => {
  it("does not insert when the user has not opted in", async () => {
    await setOptIn(false);
    await historyService.logIfEnabled(logInput(makeItinerary([])));
    expect(await historyService.list(TEST_USER_ID)).toHaveLength(0);
  });

  it("does not insert when there is no preferences row at all", async () => {
    await historyService.logIfEnabled(logInput(makeItinerary([])));
    expect(await historyService.list(TEST_USER_ID)).toHaveLength(0);
  });

  it("inserts when opted in", async () => {
    await setOptIn(true);
    await historyService.logIfEnabled(logInput(makeItinerary([])));
    const rows = await historyService.list(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.from.name).toBe("Kamppi");
    expect(rows[0]!.to.name).toBe("Pasila");
  });
});

describe("historyService.clear", () => {
  it("removes all rows and returns the count", async () => {
    await setOptIn(true);
    await historyService.logIfEnabled(logInput(makeItinerary([])));
    await historyService.logIfEnabled(logInput(makeItinerary([])));
    expect(await historyService.clear(TEST_USER_ID)).toBe(2);
    expect(await historyService.list(TEST_USER_ID)).toHaveLength(0);
  });
});

describe("historyService.suggestPins", () => {
  it("suggests a line + stop used >= 3 times", async () => {
    await setOptIn(true);
    const it = makeItinerary([
      makeLeg("HSL:1059", "550", "HSL:1040601", "Kamppi"),
    ]);
    for (let i = 0; i < 3; i++) {
      await historyService.logIfEnabled(logInput(it));
    }
    const { stops, lines } = await historyService.suggestPins(TEST_USER_ID);
    expect(lines.map((l) => l.gtfsId)).toContain("HSL:1059");
    expect(lines.find((l) => l.gtfsId === "HSL:1059")?.uses).toBe(3);
    expect(stops.map((s) => s.gtfsId)).toContain("HSL:1040601");
  });

  it("does not suggest below the 3-use threshold", async () => {
    await setOptIn(true);
    const it = makeItinerary([
      makeLeg("HSL:1059", "550", "HSL:1040601", "Kamppi"),
    ]);
    await historyService.logIfEnabled(logInput(it));
    await historyService.logIfEnabled(logInput(it));
    const { stops, lines } = await historyService.suggestPins(TEST_USER_ID);
    expect(lines).toHaveLength(0);
    expect(stops).toHaveLength(0);
  });

  it("excludes a line that is already pinned", async () => {
    await setOptIn(true);
    await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    const it = makeItinerary([
      makeLeg("HSL:1059", "550", "HSL:1040601", "Kamppi"),
    ]);
    for (let i = 0; i < 4; i++) {
      await historyService.logIfEnabled(logInput(it));
    }
    const { lines } = await historyService.suggestPins(TEST_USER_ID);
    expect(lines.map((l) => l.gtfsId)).not.toContain("HSL:1059");
  });
});

describe("historyService.pruneExpired", () => {
  it("drops rows past the user's retention window, keeps recent ones", async () => {
    await preferencesRepo.upsert(TEST_USER_ID, {
      tripLogEnabled: true,
      extra: { historyRetentionDays: 30 },
    });
    await db.insert(tripLog).values({
      userId: TEST_USER_ID,
      fromLat: 60.1,
      fromLon: 24.9,
      toLat: 60.2,
      toLon: 24.95,
      itinerary: makeItinerary([]),
      plannedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    } as never);
    await db.insert(tripLog).values({
      userId: TEST_USER_ID,
      fromLat: 60.1,
      fromLon: 24.9,
      toLat: 60.2,
      toLon: 24.95,
      itinerary: makeItinerary([]),
      plannedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    } as never);

    const removed = await historyService.pruneExpired();
    expect(removed).toBeGreaterThanOrEqual(1);
    const rows = await tripLogRepo.listByUser(TEST_USER_ID);
    expect(rows).toHaveLength(1);
  });
});
