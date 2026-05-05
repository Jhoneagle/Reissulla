import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";

describe("GET /api/v1/health", () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("returns ok status when all services are healthy", async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.services.db).toBe("ok");
    expect(body.services.redis).toBe("ok");

    await server.close();
  });

  it("returns service statuses as an object", async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    const body = response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("services");
    expect(body.services).toHaveProperty("db");
    expect(body.services).toHaveProperty("redis");

    await server.close();
  });
});
