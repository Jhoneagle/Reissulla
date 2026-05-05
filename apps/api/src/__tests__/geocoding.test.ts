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
import { _resetThrottle } from "../services/geocoding.service.js";
import type { FastifyInstance } from "fastify";

const mockSearchResponse = [
  {
    place_id: 123456,
    display_name:
      "Mannerheimintie, Etu-Töölö, Eteläinen suurpiiri, Helsinki, Helsingin seutukunta, Uusimaa, Etelä-Suomen aluehallintovirasto, Manner-Suomi, 00100, Suomi / Finland",
    name: "Mannerheimintie",
    lat: "60.1699",
    lon: "24.9384",
    type: "road",
    importance: 0.6,
  },
  {
    place_id: 789012,
    display_name:
      "Mannerheimintie, Keskusta, Tampereen keskustaajama, Tampere, Pirkanmaa, Suomi / Finland",
    name: "Mannerheimintie",
    lat: "61.4978",
    lon: "23.7610",
    type: "road",
    importance: 0.4,
  },
];

const mockReverseResponse = {
  place_id: 654321,
  display_name:
    "Rautatientori, Kluuvi, Eteläinen suurpiiri, Helsinki, Uusimaa, 00100, Suomi / Finland",
  name: "Rautatientori",
  lat: "60.1710",
  lon: "24.9414",
  address: {
    road: "Rautatientori",
    house_number: undefined,
    city: "Helsinki",
    municipality: undefined,
    county: "Helsingin seutukunta",
    state: "Uusimaa",
    postcode: "00100",
    country: "Suomi / Finland",
    country_code: "fi",
  },
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
    _resetThrottle();
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
    const first = mockSearchResponse[0]!;
    expect(body.data).toHaveLength(mockSearchResponse.length);
    expect(body.data[0].name).toBe(first.name);
    expect(body.data[0].latitude).toBe(Number(first.lat));
    expect(body.cached).toBe(false);
  });

  it("returns empty array for no results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
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

  it("returns 502 when Nominatim is down", async () => {
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
    await cacheDel("geocoding:reverse:60.17:24.94");
    vi.restoreAllMocks();
    _resetThrottle();
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
    expect(body.data.name).toBe(mockReverseResponse.name);
    expect(body.data.address.city).toBe(mockReverseResponse.address.city);
    expect(body.data.address.countryCode).toBe(
      mockReverseResponse.address.country_code,
    );
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

  it("returns 502 when Nominatim is down", async () => {
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

  it("returns 502 for non-geocodable coordinates", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unable to geocode" }), {
        status: 200,
      }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/reverse?lat=0&lon=0",
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("GEOCODING_UNAVAILABLE");
  });
});

describe("Rate limiting", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetThrottle();
  });

  it("throttles rapid requests to respect 1 req/sec", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
      );

    const start = Date.now();

    // Two uncached searches back-to-back
    await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=test1",
    });
    await server.inject({
      method: "GET",
      url: "/api/v1/geocoding/search?q=test2",
    });

    const elapsed = Date.now() - start;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Second request should have been throttled by ~1100ms
    expect(elapsed).toBeGreaterThanOrEqual(1000);

    // Clean up
    await cacheDel("geocoding:search:test1");
    await cacheDel("geocoding:search:test2");
  });
});
