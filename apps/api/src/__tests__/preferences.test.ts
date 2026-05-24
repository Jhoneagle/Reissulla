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
import { user, preferences } from "../db/schema.js";
import type { FastifyInstance } from "fastify";

vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-preferences",
          name: "Test User",
          email: "test-preferences@test.reissulla.local",
        },
        session: { id: "test-session-preferences" },
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

const TEST_USER_ID = "test-user-preferences";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-preferences@test.reissulla.local",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(preferences).where(eq(preferences.userId, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  await db.delete(preferences).where(eq(preferences.userId, TEST_USER_ID));
});

describe("GET /api/v1/preferences", () => {
  it("returns defaults for a user with no row yet", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/preferences",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.temperatureUnit).toBe("celsius");
    expect(body.data.language).toBe("en");
    expect(body.data.fontScale).toBe(100);
    expect(body.data.highContrast).toBe(false);
    expect(body.data.srOptimised).toBe(false);
  });

  it("returns the stored row when one exists", async () => {
    await db.insert(preferences).values({
      userId: TEST_USER_ID,
      language: "fi",
      highContrast: true,
      fontScale: 150,
      extra: { persona: { wheelchair: true } },
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/preferences",
    });
    expect(res.json().data.language).toBe("fi");
    expect(res.json().data.highContrast).toBe(true);
    expect(res.json().data.fontScale).toBe(150);
    expect(res.json().data.extra.persona.wheelchair).toBe(true);
  });
});

describe("PATCH /api/v1/preferences", () => {
  it("upserts a new row with the patched values", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/preferences",
      headers: { "content-type": "application/json" },
      payload: { language: "fi", theme: "dark", fontScale: 130 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.language).toBe("fi");
    expect(res.json().data.theme).toBe("dark");
    expect(res.json().data.fontScale).toBe(130);
  });

  it("merges patches into the existing row", async () => {
    await db.insert(preferences).values({
      userId: TEST_USER_ID,
      language: "fi",
      theme: "dark",
    });

    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/preferences",
      headers: { "content-type": "application/json" },
      payload: { highContrast: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.language).toBe("fi");
    expect(res.json().data.theme).toBe("dark");
    expect(res.json().data.highContrast).toBe(true);
  });

  it("validates enum values", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/preferences",
      headers: { "content-type": "application/json" },
      payload: { theme: "neon" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("clamps fontScale outside 100..200", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/preferences",
      headers: { "content-type": "application/json" },
      payload: { fontScale: 50 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("parses extra.persona via the typed boundary", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/preferences",
      headers: { "content-type": "application/json" },
      payload: {
        extra: {
          persona: { wheelchair: true, language: "fi" },
          // garbage discarded by parseExtra
          unknownField: "ignored",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.extra.persona.wheelchair).toBe(true);
    expect(res.json().data.extra.persona.language).toBe("fi");
    expect(res.json().data.extra.unknownField).toBeUndefined();
  });

  it("rejects an empty body", async () => {
    const res = await server.inject({
      method: "PATCH",
      url: "/api/v1/preferences",
      headers: { "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
