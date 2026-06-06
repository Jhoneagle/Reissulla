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
import { user, pinnedLines } from "../db/schema.js";
import type { FastifyInstance } from "fastify";

const TEST_USER_ID = "test-user-pinned-lines-routes";
const TEST_EMAIL = "test-pinned-lines-routes@test.reissulla.local";

vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-pinned-lines-routes",
          name: "Test User",
          email: "test-pinned-lines-routes@test.reissulla.local",
        },
        session: { id: "test-session" },
      }),
    },
    handler: vi.fn().mockReturnValue(() => {}),
  },
}));

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
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

async function inject(
  method: "GET" | "POST" | "DELETE",
  url: string,
  payload?: unknown,
) {
  return await server.inject({ method, url, payload: payload as object });
}

describe("Pinned lines REST", () => {
  it("POST → GET round-trip surfaces the new pin", async () => {
    const postRes = await inject("POST", "/api/v1/transit/pinned-lines", {
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    expect(postRes.statusCode).toBe(201);

    const getRes = await inject("GET", "/api/v1/transit/pinned-lines");
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
  });

  it("POST is idempotent on (user_id, gtfs_id)", async () => {
    const first = await inject("POST", "/api/v1/transit/pinned-lines", {
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    const second = await inject("POST", "/api/v1/transit/pinned-lines", {
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().data.id).toBe(second.json().data.id);

    const getRes = await inject("GET", "/api/v1/transit/pinned-lines");
    expect(getRes.json().data).toHaveLength(1);
  });

  it("POST 400s when vehicleMode is missing (NOT NULL column)", async () => {
    const res = await inject("POST", "/api/v1/transit/pinned-lines", {
      gtfsId: "HSL:1059",
      name: "550",
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE /:id removes the row", async () => {
    const postRes = await inject("POST", "/api/v1/transit/pinned-lines", {
      gtfsId: "HSL:1059",
      name: "550",
      vehicleMode: "BUS",
    });
    const id = postRes.json().data.id;

    const delRes = await inject("DELETE", `/api/v1/transit/pinned-lines/${id}`);
    expect(delRes.statusCode).toBe(204);

    const rows = await db
      .select()
      .from(pinnedLines)
      .where(eq(pinnedLines.userId, TEST_USER_ID));
    expect(rows).toEqual([]);
  });

  it("DELETE /:id returns 404 when nothing matches", async () => {
    const res = await inject(
      "DELETE",
      "/api/v1/transit/pinned-lines/does-not-exist",
    );
    expect(res.statusCode).toBe(404);
  });
});
