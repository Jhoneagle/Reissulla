import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import {
  getCapturedRequests,
  clearCapturedRequests,
} from "../../test/msw/request-log.js";

let server: FastifyInstance;

beforeAll(async () => {
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

async function clearLineSearchCache(region: string, query: string) {
  await cacheDel(`transit:line-search:v1:${region}:${query}`);
}

describe("GET /api/v1/transit/lines/search", () => {
  beforeEach(async () => {
    await clearLineSearchCache("all", "25");
    await clearLineSearchCache("hsl", "25");
    clearCapturedRequests();
  });

  it("400s when q is empty", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=",
    });
    expect(res.statusCode).toBe(400);
  });

  it("surfaces cross-region disambiguation on the default adapter", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Exact-length matches surface before "250"; both regional 25s are present.
    expect(
      body.data.slice(0, 2).map((r: { gtfsId: string }) => r.gtfsId),
    ).toEqual(["HSL:1025", "tampere:25"]);
    const agencyNames = body.data.map(
      (r: { agency: { name: string } }) => r.agency.name,
    );
    expect(agencyNames).toContain("HSL");
    expect(agencyNames).toContain("Tampereen seudun joukkoliikenne");
  });

  it("region=hsl narrows the search to HSL rows", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25&region=hsl",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].gtfsId).toBe("HSL:1025");
    expect(body.data[0].agency.name).toBe("HSL");
  });

  it("each row carries agency.name", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });

    const body = res.json();
    for (const row of body.data) {
      expect(row.agency?.name).toBeTruthy();
    }
  });

  it("serves cached response on second call", async () => {
    const first = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });
    expect(first.statusCode).toBe(200);
    const firstCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });
    expect(res.statusCode).toBe(200);
    const secondCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;
    expect(secondCount).toBe(firstCount);
    expect(res.json().cached).toBe(true);
  });
});
