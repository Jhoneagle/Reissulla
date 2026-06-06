import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { pinnedLines, user } from "../db/schema.js";
import * as pinnedLinesRepo from "../db/repositories/pinned-lines.repo.js";

const TEST_USER_ID = "test-user-pinned-lines";

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-pinned-lines@test.com",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(pinnedLines).where(eq(pinnedLines.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db.delete(pinnedLines).where(eq(pinnedLines.userId, TEST_USER_ID));
});

describe("pinnedLinesRepo.pin", () => {
  it("inserts a new row", async () => {
    const row = await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });

    expect(row.gtfsId).toBe("HSL:1059");
    expect(row.name).toBe("550");
    expect(row.vehicleMode).toBe("BUS");
  });

  it("is idempotent on (user_id, gtfs_id)", async () => {
    const first = await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    const second = await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });

    expect(second.id).toBe(first.id);
    const rows = await pinnedLinesRepo.listByUser(TEST_USER_ID);
    expect(rows).toHaveLength(1);
  });
});

describe("pinnedLinesRepo.listByUser", () => {
  it("orders by pinnedAt descending", async () => {
    await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    // Spread the insert timestamps so the ordering is observable; defaultNow
    // can collide inside the same millisecond on Postgres.
    await new Promise((r) => setTimeout(r, 10));
    await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1003",
      name: "3",
      vehicleMode: "TRAM",
    });

    const rows = await pinnedLinesRepo.listByUser(TEST_USER_ID);
    expect(rows.map((r) => r.gtfsId)).toEqual(["HSL:1003", "HSL:1059"]);
  });

  it("returns an empty array when the user has no pins", async () => {
    const rows = await pinnedLinesRepo.listByUser(TEST_USER_ID);
    expect(rows).toEqual([]);
  });
});

describe("pinnedLinesRepo.unpinByGtfsId", () => {
  it("removes the row and returns it", async () => {
    await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });

    const removed = await pinnedLinesRepo.unpinByGtfsId(
      "HSL:1059",
      TEST_USER_ID,
    );
    expect(removed?.gtfsId).toBe("HSL:1059");
    const rows = await pinnedLinesRepo.listByUser(TEST_USER_ID);
    expect(rows).toEqual([]);
  });

  it("returns undefined when nothing matches", async () => {
    const removed = await pinnedLinesRepo.unpinByGtfsId(
      "HSL:404",
      TEST_USER_ID,
    );
    expect(removed).toBeUndefined();
  });
});

describe("pinnedLinesRepo.unpinById", () => {
  it("removes by id and respects user ownership", async () => {
    const row = await pinnedLinesRepo.pin({
      userId: TEST_USER_ID,
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });

    const removed = await pinnedLinesRepo.unpinById(row.id, TEST_USER_ID);
    expect(removed?.id).toBe(row.id);

    const removedAgain = await pinnedLinesRepo.unpinById(row.id, TEST_USER_ID);
    expect(removedAgain).toBeUndefined();
  });
});
