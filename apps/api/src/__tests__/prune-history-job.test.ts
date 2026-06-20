import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tripLog, preferences, user } from "../db/schema.js";
import { pruneHistory } from "../jobs/prune-history.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";
import * as tripLogRepo from "../db/repositories/trip-log.repo.js";

const TEST_USER_ID = "test-user-prune-history-job";

const ITINERARY = { startTime: 0, endTime: 0, duration: 0, legs: [] };

function seedRow(ageDays: number) {
  return db.insert(tripLog).values({
    userId: TEST_USER_ID,
    fromLat: 60.1,
    fromLon: 24.9,
    toLat: 60.2,
    toLon: 24.95,
    itinerary: ITINERARY,
    plannedAt: new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000),
  } as never);
}

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-prune-history-job@test.reissulla.local",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
  await db.delete(preferences).where(eq(preferences.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
  await db.delete(preferences).where(eq(preferences.userId, TEST_USER_ID));
});

describe("pruneHistory", () => {
  it("drops rows older than the user's retention window and keeps fresh ones", async () => {
    await preferencesRepo.upsert(TEST_USER_ID, {
      extra: { historyRetentionDays: 30 },
    });
    await seedRow(45);
    await seedRow(10);

    const removed = await pruneHistory();
    expect(removed).toBeGreaterThanOrEqual(1);

    const rows = await tripLogRepo.listByUser(TEST_USER_ID);
    expect(rows).toHaveLength(1);
  });

  it("uses the 90-day default when no retention is set", async () => {
    await seedRow(120);
    await seedRow(80);

    await pruneHistory();

    const rows = await tripLogRepo.listByUser(TEST_USER_ID);
    expect(rows).toHaveLength(1);
  });
});
