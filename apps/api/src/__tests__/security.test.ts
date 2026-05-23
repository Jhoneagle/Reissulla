import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import type { FastifyInstance } from "fastify";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

describe("security middleware", () => {
  it("helmet sets x-content-type-options on every response", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("helmet sets x-frame-options to SAMEORIGIN", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("the rate-limit allowlist exempts /api/v1/health", async () => {
    // Even at 200 req/min, the health route is allowlisted and should
    // never return 429.
    for (let i = 0; i < 250; i++) {
      const res = await server.inject({ method: "GET", url: "/api/v1/health" });
      if (res.statusCode === 429) {
        throw new Error(
          `Health route was rate-limited on request ${i + 1} — allowlist not working`,
        );
      }
    }
    expect(true).toBe(true);
  });
});
