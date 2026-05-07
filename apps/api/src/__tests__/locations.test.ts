import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { db } from "../db/index.js";
import { savedLocations, user } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

// Must be a literal in the mock factory — vi.mock is hoisted above variable declarations
vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-locations",
          name: "Test User",
          email: "test@test.com",
        },
        session: { id: "test-session" },
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

const TEST_USER_ID = "test-user-locations";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();

  // Ensure test user exists
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-locations@test.com",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  // Clean up test data
  await db
    .delete(savedLocations)
    .where(eq(savedLocations.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  // Clear all saved locations for the test user
  await db
    .delete(savedLocations)
    .where(eq(savedLocations.userId, TEST_USER_ID));
});

describe("GET /api/v1/locations", () => {
  it("returns empty array when no locations saved", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/locations",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it("returns saved locations for the user", async () => {
    await db.insert(savedLocations).values({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
      isPrimary: true,
      sortOrder: 0,
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/locations",
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Home");
    expect(data[0].isPrimary).toBe(true);
  });
});

describe("POST /api/v1/locations", () => {
  it("saves a new location", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/locations",
      payload: { name: "Work", latitude: 60.18, longitude: 24.95 },
    });

    expect(res.statusCode).toBe(201);
    const loc = res.json().data;
    expect(loc.name).toBe("Work");
    expect(loc.latitude).toBe(60.18);
    expect(loc.isPrimary).toBe(true); // first location becomes primary
  });

  it("second location is not primary", async () => {
    await server.inject({
      method: "POST",
      url: "/api/v1/locations",
      payload: { name: "First", latitude: 60.17, longitude: 24.94 },
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/locations",
      payload: { name: "Second", latitude: 61.5, longitude: 23.76 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.isPrimary).toBe(false);
  });

  it("rejects when limit is reached", async () => {
    // Insert 20 locations
    for (let i = 0; i < 20; i++) {
      await db.insert(savedLocations).values({
        userId: TEST_USER_ID,
        name: `Location ${i}`,
        latitude: 60 + i * 0.01,
        longitude: 24 + i * 0.01,
        sortOrder: i,
      });
    }

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/locations",
      payload: { name: "Too many", latitude: 61, longitude: 25 },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("LIMIT_REACHED");
  });

  it("validates input", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/locations",
      payload: { name: "", latitude: 200, longitude: 24 },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/v1/locations/:id", () => {
  it("renames a location", async () => {
    const [loc] = await db
      .insert(savedLocations)
      .values({
        userId: TEST_USER_ID,
        name: "Old Name",
        latitude: 60.17,
        longitude: 24.94,
        sortOrder: 0,
      })
      .returning();

    const res = await server.inject({
      method: "PATCH",
      url: `/api/v1/locations/${loc!.id}`,
      payload: { name: "New Name" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("New Name");
  });

  it("sets primary and clears others", async () => {
    const [first] = await db
      .insert(savedLocations)
      .values({
        userId: TEST_USER_ID,
        name: "First",
        latitude: 60.17,
        longitude: 24.94,
        isPrimary: true,
        sortOrder: 0,
      })
      .returning();

    const [second] = await db
      .insert(savedLocations)
      .values({
        userId: TEST_USER_ID,
        name: "Second",
        latitude: 61.5,
        longitude: 23.76,
        sortOrder: 1,
      })
      .returning();

    const res = await server.inject({
      method: "PATCH",
      url: `/api/v1/locations/${second!.id}`,
      payload: { isPrimary: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isPrimary).toBe(true);

    // First should no longer be primary
    const [firstNow] = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.id, first!.id));
    expect(firstNow!.isPrimary).toBe(false);
  });

  it("returns 404 for non-existent location", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/locations/nonexistent-id",
      payload: { name: "test" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/v1/locations/:id", () => {
  it("deletes a location", async () => {
    const [loc] = await db
      .insert(savedLocations)
      .values({
        userId: TEST_USER_ID,
        name: "To Delete",
        latitude: 60.17,
        longitude: 24.94,
        sortOrder: 0,
      })
      .returning();

    const res = await server.inject({
      method: "DELETE",
      url: `/api/v1/locations/${loc!.id}`,
    });

    expect(res.statusCode).toBe(204);
  });

  it("promotes next location when deleting primary", async () => {
    const [primary] = await db
      .insert(savedLocations)
      .values({
        userId: TEST_USER_ID,
        name: "Primary",
        latitude: 60.17,
        longitude: 24.94,
        isPrimary: true,
        sortOrder: 0,
      })
      .returning();

    const [second] = await db
      .insert(savedLocations)
      .values({
        userId: TEST_USER_ID,
        name: "Second",
        latitude: 61.5,
        longitude: 23.76,
        sortOrder: 1,
      })
      .returning();

    await server.inject({
      method: "DELETE",
      url: `/api/v1/locations/${primary!.id}`,
    });

    const [promoted] = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.id, second!.id));
    expect(promoted!.isPrimary).toBe(true);
  });

  it("returns 404 for non-existent location", async () => {
    const res = await server.inject({
      method: "DELETE",
      url: "/api/v1/locations/nonexistent-id",
    });

    expect(res.statusCode).toBe(404);
  });
});
