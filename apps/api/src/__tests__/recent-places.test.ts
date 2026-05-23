import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { recentPlaces, user } from "../db/schema.js";
import * as recentPlacesRepo from "../db/repositories/recent-places.repo.js";

const TEST_USER_ID = "test-user-recent-places";

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-recent-places@test.com",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(recentPlaces).where(eq(recentPlaces.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db.delete(recentPlaces).where(eq(recentPlaces.userId, TEST_USER_ID));
});

describe("recentPlacesRepo.recordVisit", () => {
  it("inserts a new row when no nearby visit exists", async () => {
    const row = await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki Central",
    });

    expect(row.visitCount).toBe(1);
    expect(row.displayName).toBe("Helsinki Central");
  });

  it("increments visitCount when revisiting the same coordinates", async () => {
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki Central",
    });
    const second = await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki Central",
    });
    const third = await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki Central",
    });

    expect(second.visitCount).toBe(2);
    expect(third.visitCount).toBe(3);
  });

  it("rounds coordinates so near-identical visits merge", async () => {
    // 60.17001 / 24.94001 round to 60.1700 / 24.9400 at 4dp precision.
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17001,
      longitude: 24.94001,
      displayName: "Helsinki Central",
    });
    const merged = await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki Central",
    });

    expect(merged.visitCount).toBe(2);
  });

  it("keeps separate rows for coordinates differing beyond the precision floor", async () => {
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki Central",
    });
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.2,
      longitude: 24.96,
      displayName: "Pasila",
    });

    const list = await recentPlacesRepo.listByUser(TEST_USER_ID);
    expect(list).toHaveLength(2);
  });

  it("refreshes displayName to the most recent value", async () => {
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Old Name",
    });
    const updated = await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "New Name",
    });
    expect(updated.displayName).toBe("New Name");
  });
});

describe("recentPlacesRepo.listByUser", () => {
  it("orders by lastVisitedAt descending", async () => {
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "First",
    });
    await new Promise((r) => setTimeout(r, 10));
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.2,
      longitude: 24.96,
      displayName: "Second",
    });

    const list = await recentPlacesRepo.listByUser(TEST_USER_ID);
    expect(list[0]?.displayName).toBe("Second");
    expect(list[1]?.displayName).toBe("First");
  });

  it("respects the limit argument", async () => {
    for (let i = 0; i < 5; i++) {
      await recentPlacesRepo.recordVisit({
        userId: TEST_USER_ID,
        latitude: 60.17 + i * 0.01,
        longitude: 24.94,
        displayName: `Place ${i}`,
      });
    }
    const list = await recentPlacesRepo.listByUser(TEST_USER_ID, 3);
    expect(list).toHaveLength(3);
  });
});

describe("recentPlacesRepo.clearForUser", () => {
  it("removes every row for the user", async () => {
    await recentPlacesRepo.recordVisit({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki",
    });
    await recentPlacesRepo.clearForUser(TEST_USER_ID);
    expect(await recentPlacesRepo.listByUser(TEST_USER_ID)).toHaveLength(0);
  });
});
