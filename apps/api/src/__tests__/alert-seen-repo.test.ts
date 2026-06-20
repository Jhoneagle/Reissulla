import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { alertSeen, user } from "../db/schema.js";
import * as alertSeenRepo from "../db/repositories/alert-seen.repo.js";

const TEST_USER_ID = "test-user-alert-seen";
const CASCADE_USER_ID = "test-user-alert-seen-cascade";

beforeAll(async () => {
  await db
    .insert(user)
    .values([
      { id: TEST_USER_ID, name: "Test User", email: "alert-seen@test.com" },
      {
        id: CASCADE_USER_ID,
        name: "Cascade User",
        email: "alert-seen-cascade@test.com",
      },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(alertSeen).where(eq(alertSeen.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, CASCADE_USER_ID));
});

beforeEach(async () => {
  await db.delete(alertSeen).where(eq(alertSeen.userId, TEST_USER_ID));
});

describe("alertSeenRepo.markSeen", () => {
  it("inserts receipts and lists them back", async () => {
    await alertSeenRepo.markSeen(TEST_USER_ID, ["a1", "a2"]);
    const ids = await alertSeenRepo.listSeenIds(TEST_USER_ID);
    expect([...ids].sort()).toEqual(["a1", "a2"]);
  });

  it("is idempotent on the (user_id, alert_id) primary key", async () => {
    await alertSeenRepo.markSeen(TEST_USER_ID, ["a1"]);
    await alertSeenRepo.markSeen(TEST_USER_ID, ["a1"]);
    const ids = await alertSeenRepo.listSeenIds(TEST_USER_ID);
    expect(ids).toEqual(["a1"]);
  });

  it("dedupes repeated ids within a single batch", async () => {
    await alertSeenRepo.markSeen(TEST_USER_ID, ["a1", "a1", "a2"]);
    const ids = await alertSeenRepo.listSeenIds(TEST_USER_ID);
    expect([...ids].sort()).toEqual(["a1", "a2"]);
  });

  it("no-ops on an empty batch", async () => {
    await alertSeenRepo.markSeen(TEST_USER_ID, []);
    expect(await alertSeenRepo.listSeenIds(TEST_USER_ID)).toEqual([]);
  });
});

describe("alertSeenRepo.pruneNotIn", () => {
  it("removes receipts whose alertId is no longer active, keeps the rest", async () => {
    await alertSeenRepo.markSeen(TEST_USER_ID, ["keep", "drop"]);
    const removed = await alertSeenRepo.pruneNotIn(["keep"]);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await alertSeenRepo.listSeenIds(TEST_USER_ID)).toEqual(["keep"]);
  });

  it("clears all receipts when the active set is empty", async () => {
    await alertSeenRepo.markSeen(TEST_USER_ID, ["x", "y"]);
    await alertSeenRepo.pruneNotIn([]);
    expect(await alertSeenRepo.listSeenIds(TEST_USER_ID)).toEqual([]);
  });
});

describe("alert_seen cascade", () => {
  it("deletes a user's receipts when the user is deleted", async () => {
    await alertSeenRepo.markSeen(CASCADE_USER_ID, ["c1"]);
    expect(await alertSeenRepo.listSeenIds(CASCADE_USER_ID)).toEqual(["c1"]);

    await db.delete(user).where(eq(user.id, CASCADE_USER_ID));
    expect(await alertSeenRepo.listSeenIds(CASCADE_USER_ID)).toEqual([]);
  });
});
