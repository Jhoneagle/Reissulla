import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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

describe("error envelope", () => {
  it("returns { error: { code, message, source: 'self' } } on validation failure via badRequest", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/search?q=",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.source).toBe("self");
    expect(typeof body.error.message).toBe("string");
  });

  it("returns { error: { code, source: 'fastify' } } on Fastify schema validation failure", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.source).toBe("fastify");
  });

  it("returns { error: { code: 'TRANSIT_UNAVAILABLE', source: 'digitransit-finland' } } when the upstream fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops?lat=60.17&lon=24.94",
    });

    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error.code).toBe("TRANSIT_UNAVAILABLE");
    expect(body.error.source).toBe("digitransit-finland");
  });

  it("returns 401 UNAUTHORIZED with source 'self' on unauthenticated /me", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/me",
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.source).toBe("self");
  });

  it("propagates Fastify body-parser errors as 400 with source 'fastify' instead of 500", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/locations",
      headers: { "content-type": "application/json" },
      payload: "{not valid json",
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    const body = res.json();
    expect(body.error.source).toBe("fastify");
    expect(typeof body.error.code).toBe("string");
  });
});
