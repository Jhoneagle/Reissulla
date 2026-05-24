import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { eq, inArray } from "drizzle-orm";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { db } from "../db/index.js";
import {
  user,
  preferences,
  savedLocations,
  recentPlaces,
} from "../db/schema.js";
import type { FastifyInstance } from "fastify";

// Inline strings — vi.mock is hoisted, so referencing module-scope `const`s
// inside the factory throws "cannot access before initialization".
vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-account",
          name: "Test User",
          email: "test-account@test.reissulla.local",
        },
        session: { id: "test-session-account" },
      }),
    },
    handler: vi
      .fn()
      .mockReturnValue(
        (
          _req: unknown,
          res: { writeHead: (s: number) => void; end: () => void },
        ) => {
          res.writeHead(404);
          res.end();
        },
      ),
  },
}));

const TEST_USER_ID = "test-user-account";
const TEST_EMAIL = "test-account@test.reissulla.local";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  // Cleanup in case a test left rows behind (deleteAccount cascades, but the
  // user might not have been created if a test failed early).
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await db.insert(user).values({
    id: TEST_USER_ID,
    name: "Test User",
    email: TEST_EMAIL,
  });
});

describe("GET /api/v1/account/export", () => {
  it("returns user, preferences, savedLocations, and recentPlaces", async () => {
    await db.insert(preferences).values({
      userId: TEST_USER_ID,
      temperatureUnit: "celsius",
      language: "fi",
      extra: { persona: { wheelchair: true, language: "fi" } },
    });
    await db.insert(savedLocations).values({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
      isPrimary: true,
      sortOrder: 0,
      category: "home",
      region: "Helsinki",
    });
    await db.insert(recentPlaces).values({
      userId: TEST_USER_ID,
      latitude: 60.2,
      longitude: 24.96,
      displayName: "Pasila",
      visitCount: 2,
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/account/export",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.schemaVersion).toBe(1);
    expect(body.user.email).toBe(TEST_EMAIL);
    expect(body.preferences?.language).toBe("fi");
    expect(body.preferences?.extra?.persona?.wheelchair).toBe(true);
    expect(body.savedLocations).toHaveLength(1);
    expect(body.savedLocations[0].name).toBe("Home");
    expect(body.savedLocations[0].category).toBe("home");
    expect(body.savedLocations[0].region).toBe("Helsinki");
    expect(body.recentPlaces).toHaveLength(1);
    expect(body.recentPlaces[0].displayName).toBe("Pasila");

    // Tables that exist but the test user has not populated round-trip as
    // empty arrays; future-table fields stay declared so the export shape is
    // stable when those tables ship.
    expect(body.pinnedStops).toEqual([]);
    expect(body.recentStops).toEqual([]);
    expect(body.pinnedLines).toEqual([]);
    expect(body.tripLog).toEqual([]);
    expect(body.alertSeen).toEqual([]);
    expect(body.shareTokens).toEqual([]);
  });

  it("sets a Content-Disposition header for download", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/account/export",
    });
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("reissulla-export");
  });
});

describe("DELETE /api/v1/account", () => {
  it("deletes the user and cascades to their data", async () => {
    await db.insert(savedLocations).values({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
    });
    await db.insert(preferences).values({
      userId: TEST_USER_ID,
      language: "en",
    });

    const res = await server.inject({
      method: "DELETE",
      url: "/api/v1/account",
    });

    expect(res.statusCode).toBe(204);

    const remainingUser = await db
      .select()
      .from(user)
      .where(eq(user.id, TEST_USER_ID));
    expect(remainingUser).toHaveLength(0);

    const remainingLocations = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, TEST_USER_ID));
    expect(remainingLocations).toHaveLength(0);

    const remainingPrefs = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, TEST_USER_ID));
    expect(remainingPrefs).toHaveLength(0);
  });
});

describe("Export → delete → re-query round-trip", () => {
  it("exported data survives until deletion, then the user is gone", async () => {
    await db.insert(savedLocations).values({
      userId: TEST_USER_ID,
      name: "Roundtrip",
      latitude: 60.17,
      longitude: 24.94,
    });

    const exportRes = await server.inject({
      method: "GET",
      url: "/api/v1/account/export",
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.json().savedLocations).toHaveLength(1);

    const deleteRes = await server.inject({
      method: "DELETE",
      url: "/api/v1/account",
    });
    expect(deleteRes.statusCode).toBe(204);

    const rowsAfter = await db
      .select()
      .from(user)
      .where(inArray(user.id, [TEST_USER_ID]));
    expect(rowsAfter).toHaveLength(0);
  });
});

describe("PATCH /api/v1/me", () => {
  it("updates the user's name", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { "content-type": "application/json" },
      payload: { name: "New Name" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.name).toBe("New Name");

    const [row] = await db.select().from(user).where(eq(user.id, TEST_USER_ID));
    expect(row?.name).toBe("New Name");
  });

  it("rejects empty names via schema validation", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { "content-type": "application/json" },
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
  });
});
