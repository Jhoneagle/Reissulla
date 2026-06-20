import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tripLog, user } from "../db/schema.js";
import * as tripLogRepo from "../db/repositories/trip-log.repo.js";

const TEST_USER_ID = "test-user-trip-log-repo";

const ITINERARY = { startTime: 1, endTime: 2, duration: 1, legs: [] };

function baseInsert(over: Partial<tripLogRepo.TripLogInsert> = {}) {
  return {
    userId: TEST_USER_ID,
    fromLat: 60.17,
    fromLon: 24.94,
    toLat: 60.2,
    toLon: 24.96,
    fromName: "Kamppi",
    toName: "Pasila",
    itinerary: ITINERARY,
    ...over,
  };
}

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-trip-log-repo@test.reissulla.local",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
});

describe("tripLogRepo.insert + listByUser", () => {
  it("inserts a row with the snapshot itinerary", async () => {
    const row = await tripLogRepo.insert(baseInsert());
    expect(row.fromName).toBe("Kamppi");
    expect(row.itinerary).toEqual(ITINERARY);
  });

  it("lists newest-first", async () => {
    await db
      .insert(tripLog)
      .values(baseInsert({ fromName: "older", itinerary: ITINERARY }) as never);
    // Force distinct timestamps so ordering is deterministic.
    await db.insert(tripLog).values({
      ...baseInsert({ fromName: "older" }),
      plannedAt: new Date(Date.now() - 60_000),
    } as never);
    await db.insert(tripLog).values({
      ...baseInsert({ fromName: "newer" }),
      plannedAt: new Date(),
    } as never);
    const rows = await tripLogRepo.listByUser(TEST_USER_ID);
    expect(rows[0]!.fromName).toBe("newer");
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) await tripLogRepo.insert(baseInsert());
    const rows = await tripLogRepo.listByUser(TEST_USER_ID, { limit: 2 });
    expect(rows).toHaveLength(2);
  });

  it("filters by sinceDays", async () => {
    await db.insert(tripLog).values({
      ...baseInsert({ fromName: "old" }),
      plannedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    } as never);
    await db.insert(tripLog).values({
      ...baseInsert({ fromName: "recent" }),
      plannedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    } as never);
    const rows = await tripLogRepo.listByUser(TEST_USER_ID, { sinceDays: 7 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fromName).toBe("recent");
  });
});

describe("tripLogRepo.clearByUser", () => {
  it("deletes all rows and returns the count", async () => {
    await tripLogRepo.insert(baseInsert());
    await tripLogRepo.insert(baseInsert());
    const removed = await tripLogRepo.clearByUser(TEST_USER_ID);
    expect(removed).toBe(2);
    expect(await tripLogRepo.listByUser(TEST_USER_ID)).toHaveLength(0);
  });
});

describe("tripLogRepo.deleteOlderThan", () => {
  it("drops only rows older than the cutoff", async () => {
    await db.insert(tripLog).values({
      ...baseInsert({ fromName: "old" }),
      plannedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    } as never);
    await db.insert(tripLog).values({
      ...baseInsert({ fromName: "recent" }),
      plannedAt: new Date(),
    } as never);
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const removed = await tripLogRepo.deleteOlderThan(TEST_USER_ID, cutoff);
    expect(removed).toBe(1);
    const rows = await tripLogRepo.listByUser(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fromName).toBe("recent");
  });
});

describe("tripLogRepo.listUserIdsWithRows", () => {
  it("includes the user once when rows exist", async () => {
    await tripLogRepo.insert(baseInsert());
    await tripLogRepo.insert(baseInsert());
    const ids = await tripLogRepo.listUserIdsWithRows();
    expect(ids.filter((id) => id === TEST_USER_ID)).toHaveLength(1);
  });
});
