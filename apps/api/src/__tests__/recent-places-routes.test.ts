import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { db } from "../db/index.js";
import { user, recentPlaces } from "../db/schema.js";
import type { FastifyInstance } from "fastify";

vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-recent-places-routes",
          name: "Test User",
          email: "test-recent-places-routes@test.reissulla.local",
        },
        session: { id: "test-session-recent-places" },
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

const TEST_USER_ID = "test-user-recent-places-routes";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-recent-places-routes@test.reissulla.local",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(recentPlaces).where(eq(recentPlaces.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  await db.delete(recentPlaces).where(eq(recentPlaces.userId, TEST_USER_ID));
});

describe("POST /api/v1/recent-places", () => {
  it("records a visit and returns visitCount", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/recent-places",
      headers: { "content-type": "application/json" },
      payload: {
        latitude: 60.17,
        longitude: 24.94,
        displayName: "Helsinki Central",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.visitCount).toBe(1);
    expect(res.json().data.displayName).toBe("Helsinki Central");
  });

  it("increments visitCount on revisits — FE uses this to gate the save-prompt", async () => {
    for (let i = 0; i < 3; i++) {
      await server.inject({
        method: "POST",
        url: "/api/v1/recent-places",
        headers: { "content-type": "application/json" },
        payload: {
          latitude: 60.17,
          longitude: 24.94,
          displayName: "Helsinki Central",
        },
      });
    }

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/recent-places",
    });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].visitCount).toBe(3);
  });

  it("rejects invalid latitude", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/recent-places",
      headers: { "content-type": "application/json" },
      payload: { latitude: 91, longitude: 24.94, displayName: "x" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/recent-places", () => {
  it("orders by lastVisitedAt desc with a default limit of 20", async () => {
    await db.insert(recentPlaces).values([
      {
        userId: TEST_USER_ID,
        latitude: 60.17,
        longitude: 24.94,
        displayName: "Older",
        lastVisitedAt: new Date(Date.now() - 60_000),
      },
      {
        userId: TEST_USER_ID,
        latitude: 60.2,
        longitude: 24.96,
        displayName: "Newer",
      },
    ]);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/recent-places",
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data[0].displayName).toBe("Newer");
    expect(data[1].displayName).toBe("Older");
  });

  it("respects the limit query parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await db.insert(recentPlaces).values({
        userId: TEST_USER_ID,
        latitude: 60.17 + i * 0.01,
        longitude: 24.94,
        displayName: `Place ${i}`,
      });
    }

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/recent-places?limit=3",
    });
    expect(res.json().data).toHaveLength(3);
  });

  it("clamps an oversized limit", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/recent-places?limit=99999",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /api/v1/recent-places", () => {
  it("clears every row for the user", async () => {
    await db.insert(recentPlaces).values({
      userId: TEST_USER_ID,
      latitude: 60.17,
      longitude: 24.94,
      displayName: "Helsinki",
    });

    const res = await server.inject({
      method: "DELETE",
      url: "/api/v1/recent-places",
    });
    expect(res.statusCode).toBe(204);

    const remaining = await db
      .select()
      .from(recentPlaces)
      .where(eq(recentPlaces.userId, TEST_USER_ID));
    expect(remaining).toHaveLength(0);
  });

  it("deletes a specific row by id", async () => {
    const [row] = await db
      .insert(recentPlaces)
      .values({
        userId: TEST_USER_ID,
        latitude: 60.17,
        longitude: 24.94,
        displayName: "Helsinki",
      })
      .returning();

    const res = await server.inject({
      method: "DELETE",
      url: `/api/v1/recent-places/${row!.id}`,
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when the id is unknown", async () => {
    const res = await server.inject({
      method: "DELETE",
      url: "/api/v1/recent-places/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
  });
});
