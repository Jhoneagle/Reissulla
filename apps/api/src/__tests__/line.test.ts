import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { regionFromAgencyId } from "../services/transit/lines.service.js";
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

describe("regionFromAgencyId", () => {
  it("returns Helsingin seutu for HSL prefixes", () => {
    expect(regionFromAgencyId("HSL:HSL")).toBe("Helsingin seutu");
    expect(regionFromAgencyId("HSLlautta:Suomenlinna")).toBe("Helsingin seutu");
  });

  it("returns the matching Waltti regional label", () => {
    expect(regionFromAgencyId("tampere:Nysse")).toBe("Tampereen seutu");
    expect(regionFromAgencyId("OULU:Oulu")).toBe("Oulun seutu");
  });

  it("returns ELY-alue for Varely prefixes", () => {
    expect(regionFromAgencyId("VARELY:Express")).toBe("ELY-alue");
  });

  it("returns null for unknown prefixes", () => {
    expect(regionFromAgencyId("matka:42")).toBeNull();
    expect(regionFromAgencyId("")).toBeNull();
  });
});

describe("GET /api/v1/transit/lines/:gtfsId", () => {
  beforeEach(async () => {
    await cacheDel("transit:line:v1:HSL:1059");
    await cacheDel("transit:line:v1:HSL:1009");
    await cacheDel("transit:line:v1:HSL:404");
    clearCapturedRequests();
  });

  it("returns both directional patterns + stops", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.shortName).toBe("550");
    expect(body.data.agency).toEqual({ gtfsId: "HSL:HSL", name: "HSL" });
    expect(body.data.region).toBe("Helsingin seutu");
    expect(body.data.patterns).toHaveLength(2);
    expect(body.data.patterns[0].stops).toHaveLength(2);
    expect(body.data.patterns[0].headsign).toBe("Westendinasema");
    expect(body.data.patterns[1].headsign).toBe("Itäkeskus");
  });

  it("404s on an unknown gtfsId", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:404",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a single-direction line with patterns.length === 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1009",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.patterns).toHaveLength(1);
  });

  it("serves cached response on second call", async () => {
    const first = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059",
    });
    expect(first.statusCode).toBe(200);
    const firstCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059",
    });
    const secondCount = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;
    expect(secondCount).toBe(firstCount);
    expect(res.json().cached).toBe(true);
  });

  it("decodes URL-encoded gtfsIds (colon-bearing prefix)", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL%3A1059",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.gtfsId).toBe("HSL:1059");
  });
});
