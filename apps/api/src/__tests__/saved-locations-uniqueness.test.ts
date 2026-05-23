import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { savedLocations, user } from "../db/schema.js";

const TEST_USER_ID = "test-user-uniqueness";

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-uniqueness@test.com",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(savedLocations)
    .where(eq(savedLocations.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db
    .delete(savedLocations)
    .where(eq(savedLocations.userId, TEST_USER_ID));
});

describe("saved_locations partial unique index on (user_id, category)", () => {
  it("rejects a second home for the same user", async () => {
    await db.insert(savedLocations).values({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
      category: "home",
    });

    await expect(
      db.insert(savedLocations).values({
        userId: TEST_USER_ID,
        name: "Other Home",
        latitude: 60.2,
        longitude: 24.96,
        category: "home",
      }),
    ).rejects.toThrow();
  });

  it("rejects a second work for the same user", async () => {
    await db.insert(savedLocations).values({
      userId: TEST_USER_ID,
      name: "Work",
      latitude: 60.17,
      longitude: 24.94,
      category: "work",
    });

    await expect(
      db.insert(savedLocations).values({
        userId: TEST_USER_ID,
        name: "Other Work",
        latitude: 60.2,
        longitude: 24.96,
        category: "work",
      }),
    ).rejects.toThrow();
  });

  it("allows multiple rows in other categories", async () => {
    await db.insert(savedLocations).values([
      {
        userId: TEST_USER_ID,
        name: "Cottage A",
        latitude: 60.17,
        longitude: 24.94,
        category: "cottage",
      },
      {
        userId: TEST_USER_ID,
        name: "Cottage B",
        latitude: 60.2,
        longitude: 24.96,
        category: "cottage",
      },
    ]);

    const rows = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, TEST_USER_ID));
    expect(rows).toHaveLength(2);
  });

  it("allows multiple rows with no category", async () => {
    await db.insert(savedLocations).values([
      {
        userId: TEST_USER_ID,
        name: "Place A",
        latitude: 60.17,
        longitude: 24.94,
      },
      {
        userId: TEST_USER_ID,
        name: "Place B",
        latitude: 60.2,
        longitude: 24.96,
      },
    ]);

    const rows = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, TEST_USER_ID));
    expect(rows).toHaveLength(2);
  });

  it("allows home + work for the same user (different categories)", async () => {
    await db.insert(savedLocations).values([
      {
        userId: TEST_USER_ID,
        name: "Home",
        latitude: 60.17,
        longitude: 24.94,
        category: "home",
      },
      {
        userId: TEST_USER_ID,
        name: "Work",
        latitude: 60.2,
        longitude: 24.96,
        category: "work",
      },
    ]);

    const rows = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, TEST_USER_ID));
    expect(rows).toHaveLength(2);
  });
});
