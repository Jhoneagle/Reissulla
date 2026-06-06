import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { regionFromAgencyId } from "../services/transit/lines.service.js";

let server: FastifyInstance;

beforeAll(async () => {
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

// Two-direction line, two stops per direction — minimum fixture that
// exercises the direction toggle on the LineView page.
const mockRoute550Response = {
  data: {
    route: {
      gtfsId: "HSL:1059",
      shortName: "550",
      longName: "Itäkeskus - Westendinasema",
      mode: "BUS",
      color: "00A6E2",
      textColor: "FFFFFF",
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1059:0:01",
          headsign: "Westendinasema",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:1454102",
              name: "Itäkeskus",
              lat: 60.21,
              lon: 25.08,
              code: "T1234",
              platformCode: null,
            },
            {
              gtfsId: "HSL:2222204",
              name: "Westendinasema",
              lat: 60.17,
              lon: 24.81,
              code: "E2222",
              platformCode: null,
            },
          ],
        },
        {
          code: "HSL:1059:1:01",
          headsign: "Itäkeskus",
          directionId: 1,
          stops: [
            {
              gtfsId: "HSL:2222204",
              name: "Westendinasema",
              lat: 60.17,
              lon: 24.81,
              code: "E2222",
              platformCode: null,
            },
            {
              gtfsId: "HSL:1454102",
              name: "Itäkeskus",
              lat: 60.21,
              lon: 25.08,
              code: "T1234",
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

const mockRouteSingleDirectionResponse = {
  data: {
    route: {
      gtfsId: "HSL:1009",
      shortName: "9",
      longName: "Kolmikulma - Pasila",
      mode: "TRAM",
      color: null,
      textColor: null,
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1009:0:01",
          headsign: "Pasila",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:1010101",
              name: "Kolmikulma",
              lat: 60.16,
              lon: 24.94,
              code: null,
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

const mockRouteNotFound = { data: { route: null } };

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
    vi.restoreAllMocks();
  });

  it("returns both directional patterns + stops", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRoute550Response), { status: 200 }),
    );

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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRouteNotFound), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:404",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a single-direction line with patterns.length === 1", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRouteSingleDirectionResponse), {
        status: 200,
      }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1009",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.patterns).toHaveLength(1);
  });

  it("serves cached response on second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockRoute550Response), { status: 200 }),
      );

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL:1059",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.json().cached).toBe(true);
  });

  it("decodes URL-encoded gtfsIds (colon-bearing prefix)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRoute550Response), { status: 200 }),
    );

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/HSL%3A1059",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.gtfsId).toBe("HSL:1059");
  });
});
