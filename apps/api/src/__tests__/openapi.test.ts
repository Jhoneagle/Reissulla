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

describe("GET /api/v1/openapi.json", () => {
  it("serves a valid OpenAPI 3.x document with the API info block", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info.title).toBe("Reissulla API");
    expect(body.info.version).toBeTruthy();
  });

  it("documents the routes that exist on the server", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
    });
    const body = res.json();

    // Spot-check the kinds of paths the FE / mobile clients consume.
    expect(body.paths).toHaveProperty("/api/v1/health");
    expect(body.paths).toHaveProperty("/api/v1/preferences");
    expect(body.paths).toHaveProperty("/api/v1/locations");
    expect(body.paths).toHaveProperty("/api/v1/transit/stops");
  });

  it("captures path parameters from the route schemas", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
    });
    const body = res.json();

    const stopsParams = body.paths["/api/v1/transit/stops"]?.get?.parameters;
    expect(Array.isArray(stopsParams)).toBe(true);
    const paramNames = (stopsParams as { name: string }[]).map((p) => p.name);
    expect(paramNames).toContain("lat");
    expect(paramNames).toContain("lon");
  });
});
