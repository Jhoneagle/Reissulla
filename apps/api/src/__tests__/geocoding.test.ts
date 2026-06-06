import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import type { FastifyInstance } from "fastify";

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

describe("Geocoding search - input validation", () => {
  it("returns 400 when q is missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when q is empty", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when q is only whitespace", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=%20%20",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("Geocoding reverse - input validation", () => {
  it("returns 400 when lat/lon are missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for empty coordinates", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=&lon=",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for out-of-range lat", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=91&lon=24",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/geocoding/search", () => {
  beforeEach(async () => {
    await cacheDel("geocoding:search:v1:mannerheimintie");
    await cacheDel("geocoding:search:v1:helsinki");
    await cacheDel("geocoding:search:v1:xyznonexistent12345");
  });

  it("returns results for a Finnish address", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Mannerheimintie",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].name).toBe("Mannerheimintie");
    expect(body.data[0].latitude).toBe(60.1699);
    expect(body.data[0].locality).toBe("Helsinki");
    expect(body.cached).toBe(false);
  });

  it("returns empty array for no results", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=xyznonexistent12345",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it("serves cached response on second call", async () => {
    const first = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Mannerheimintie",
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().cached).toBe(false);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Mannerheimintie",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    // The "Helsinki" query is wired in fixtures to return HTTP 503.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Helsinki",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("GEOCODING_UNAVAILABLE");
  });
});

describe("GET /api/v1/geocoding/reverse", () => {
  beforeEach(async () => {
    await cacheDel("geocoding:reverse:v1:60.1710:24.9414");
    await cacheDel("geocoding:reverse:v1:60.1700:24.9400");
    await cacheDel("geocoding:reverse:v1:0.0000:0.0000");
  });

  it("returns address for Helsinki coordinates", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.1710&lon=24.9414",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.name).toBe("Rautatientori");
    expect(body.data.address.city).toBe("Helsinki");
    expect(body.data.address.neighbourhood).toBe("Kluuvi");
    expect(body.cached).toBe(false);
  });

  it("serves cached reverse response on second call", async () => {
    const first = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.1710&lon=24.9414",
    });
    expect(first.json().cached).toBe(false);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.1710&lon=24.9414",
    });

    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    // (60.17, 24.94) → fixture returns a network error.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.17&lon=24.94",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("GEOCODING_UNAVAILABLE");
  });

  it("returns 502 for empty reverse results", async () => {
    // (0, 0) → fixture returns an empty FeatureCollection.
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=0&lon=0",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("GEOCODING_UNAVAILABLE");
  });
});
