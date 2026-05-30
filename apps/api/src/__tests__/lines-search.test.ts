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

let server: FastifyInstance;

beforeAll(async () => {
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

// Routes(name:) responses keyed by feed. The mocked fetch dispatches by
// inspecting the request URL so the same test fixture covers cross-region
// (Finland adapter) and region-filtered ("hsl") calls.
const routesByFeed: Record<string, unknown> = {
  finland: {
    data: {
      routes: [
        {
          gtfsId: "HSL:1025",
          shortName: "25",
          longName: "Itäkeskus - Mellunmäki",
          mode: "BUS",
          color: "00A6E2",
          textColor: "FFFFFF",
          agency: { gtfsId: "HSL:HSL", name: "HSL" },
        },
        {
          gtfsId: "tampere:25",
          shortName: "25",
          longName: "Reumasairaala - Hervanta",
          mode: "BUS",
          color: null,
          textColor: null,
          agency: {
            gtfsId: "tampere:Nysse",
            name: "Tampereen seudun joukkoliikenne",
          },
        },
        {
          gtfsId: "HSL:1250",
          shortName: "250",
          longName: "Helsinki - Bemböle",
          mode: "BUS",
          color: null,
          textColor: null,
          agency: { gtfsId: "HSL:HSL", name: "HSL" },
        },
      ],
    },
  },
  hsl: {
    data: {
      routes: [
        {
          gtfsId: "HSL:1025",
          shortName: "25",
          longName: "Itäkeskus - Mellunmäki",
          mode: "BUS",
          color: "00A6E2",
          textColor: "FFFFFF",
          agency: { gtfsId: "HSL:HSL", name: "HSL" },
        },
      ],
    },
  },
};

function pickFeed(input: Request | string | URL): keyof typeof routesByFeed {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/hsl/")) return "hsl";
  return "finland";
}

function mockRoutesFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: Request | string | URL) => {
      const feed = pickFeed(input);
      return new Response(JSON.stringify(routesByFeed[feed]), { status: 200 });
    });
}

async function clearLineSearchCache(region: string, query: string) {
  await cacheDel(`transit:line-search:v1:${region}:${query}`);
}

describe("GET /api/v1/transit/lines/search", () => {
  beforeEach(async () => {
    await clearLineSearchCache("all", "25");
    await clearLineSearchCache("hsl", "25");
    vi.restoreAllMocks();
  });

  it("400s when q is empty", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=",
    });
    expect(res.statusCode).toBe(400);
  });

  it("surfaces cross-region disambiguation on the default adapter", async () => {
    mockRoutesFetch();

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
    mockRoutesFetch();

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
    mockRoutesFetch();

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
    const fetchSpy = mockRoutesFetch();

    await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.json().cached).toBe(true);
  });
});
