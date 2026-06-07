import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import * as featureFlagService from "../services/featureFlag.service.js";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
  vi.restoreAllMocks();
});

describe("GET /api/v1/me/feature-flags", () => {
  it("returns only the FE-facing feature subset (no feed flags)", async () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: true },
      feature: { realtimeSse: true },
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/me/feature-flags",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ feature: { realtimeSse: true } });
    // The feed slice is server-only — must not leak to the wire.
    expect(body).not.toHaveProperty("feed");
  });

  it("reflects the realtimeSse kill-switch when it flips off", async () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: true },
      feature: { realtimeSse: false },
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/me/feature-flags",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().feature.realtimeSse).toBe(false);
  });

  it("does not require authentication", async () => {
    // No session attached. Anonymous users still need to know whether the
    // SSE behaviour is available so the polling fallback engages cleanly.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/me/feature-flags",
    });

    expect(res.statusCode).toBe(200);
  });
});
