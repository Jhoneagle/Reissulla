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
import type { TransitItinerary } from "@reissulla/shared";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { db } from "../db/index.js";
import { tripLog, user } from "../db/schema.js";
import type { FastifyInstance } from "fastify";

// Inline strings — vi.mock is hoisted above module-scope consts, so the
// factory cannot reference them (see account.test.ts for the same pattern).
vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-history-route",
          name: "Test User",
          email: "test-history-route@test.reissulla.local",
        },
        session: { id: "test-session-history-route" },
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

const TEST_USER_ID = "test-user-history-route";
const TEST_EMAIL = "test-history-route@test.reissulla.local";

const ITINERARY: TransitItinerary = {
  startTime: 0,
  endTime: 0,
  duration: 0,
  walkDistance: 0,
  transfers: 0,
  legs: [],
};

function seedRow(over: Partial<typeof tripLog.$inferInsert> = {}) {
  return db.insert(tripLog).values({
    userId: TEST_USER_ID,
    fromLat: 60.17,
    fromLon: 24.94,
    toLat: 60.2,
    toLon: 24.96,
    fromName: "Kamppi",
    toName: "Pasila",
    itinerary: ITINERARY,
    ...over,
  } as never);
}

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
  await db
    .insert(user)
    .values({ id: TEST_USER_ID, name: "Test User", email: TEST_EMAIL })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  await db.delete(tripLog).where(eq(tripLog.userId, TEST_USER_ID));
});

describe("GET /api/v1/history/trips", () => {
  it("returns the user's recorded trips, newest first", async () => {
    await seedRow({
      fromName: "old",
      plannedAt: new Date(Date.now() - 60_000),
    });
    await seedRow({ fromName: "new", plannedAt: new Date() });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/history/trips",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].from.name).toBe("new");
  });

  it("honours the limit query param", async () => {
    await seedRow();
    await seedRow();
    await seedRow();
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/history/trips?limit=2",
    });
    expect(res.json().data).toHaveLength(2);
  });
});

describe("DELETE /api/v1/history/trips", () => {
  it("clears the trip log and returns the removed count", async () => {
    await seedRow();
    await seedRow();
    const res = await server.inject({
      method: "DELETE",
      url: "/api/v1/history/trips",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.removed).toBe(2);

    const after = await server.inject({
      method: "GET",
      url: "/api/v1/history/trips",
    });
    expect(after.json().data).toHaveLength(0);
  });
});

describe("GET /api/v1/history/suggested-pins", () => {
  it("returns empty stop/line arrays when there is nothing to suggest", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/history/suggested-pins",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ stops: [], lines: [] });
  });
});
