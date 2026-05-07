import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import type { FastifyInstance } from "fastify";

/** Pelias GeoJSON search response mock. */
const mockSearchResponse = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [24.9384, 60.1699] },
      properties: {
        id: "way/123",
        gid: "openstreetmap:street:way/123",
        layer: "street",
        source: "openstreetmap",
        name: "Mannerheimintie",
        label: "Mannerheimintie, Helsinki",
        confidence: 0.9,
        locality: "Helsinki",
        neighbourhood: "Etu-Töölö",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [23.761, 61.4978] },
      properties: {
        id: "way/456",
        gid: "openstreetmap:street:way/456",
        layer: "street",
        source: "openstreetmap",
        name: "Mannerheimintie",
        label: "Mannerheimintie, Tampere",
        confidence: 0.7,
        locality: "Tampere",
      },
    },
  ],
};

/** Pelias GeoJSON reverse response mock. */
const mockReverseResponse = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [24.9414, 60.171] },
      properties: {
        id: "node/654",
        gid: "openstreetmap:venue:node/654",
        layer: "venue",
        source: "openstreetmap",
        name: "Rautatientori",
        label: "Rautatientori, Helsinki",
        confidence: 1.0,
        locality: "Helsinki",
        neighbourhood: "Kluuvi",
        street: "Rautatientori",
        postalcode: "00100",
        country: "Suomi",
        region: "Uusimaa",
      },
    },
  ],
};

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
    await cacheDel("geocoding:search:mannerheimintie");
    vi.restoreAllMocks();
  });

  it("returns results for a Finnish address", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Mannerheimintie",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("Mannerheimintie");
    expect(body.data[0].latitude).toBe(60.1699);
    expect(body.data[0].locality).toBe("Helsinki");
    expect(body.cached).toBe(false);
  });

  it("returns empty array for no results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ type: "FeatureCollection", features: [] }),
        { status: 200 },
      ),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=xyznonexistent12345",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it("serves cached response on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
      );

    await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Mannerheimintie",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=Mannerheimintie",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

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
    await cacheDel("geocoding:reverse:60.1710:24.9414");
    vi.restoreAllMocks();
  });

  it("returns address for Helsinki coordinates", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockReverseResponse), { status: 200 }),
    );

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
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockReverseResponse), { status: 200 }),
      );

    await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.1710&lon=24.9414",
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.1710&lon=24.9414",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.json().cached).toBe(true);
  });

  it("returns 502 when Digitransit is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=60.17&lon=24.94",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("GEOCODING_UNAVAILABLE");
  });

  it("returns 502 for empty reverse results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ type: "FeatureCollection", features: [] }),
        { status: 200 },
      ),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=0&lon=0",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("GEOCODING_UNAVAILABLE");
  });
});
