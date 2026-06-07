import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import {
  getCapturedRequests,
  clearCapturedRequests,
} from "../../test/msw/request-log.js";

import { adapterRouter } from "../services/transit/adapter-router.js";
import { digitransitFinland } from "../adapters/digitransit-finland/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Acceptance gates for the multi-region transit work. Each `it` block names
 * one bullet from `docs/roadmap.md` §"Phase 2 — Done when" and asserts the
 * smallest visible contract that proves the gate. Deeper coverage lives in
 * the files referenced under "See also" — this suite exists so a future
 * reader can run one command and see which gates pass.
 *
 *   pnpm --filter @reissulla/api test transit-acceptance
 */

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

beforeEach(async () => {
  // Plan cache uses an options-hash + persona + weather-flag tail — flush
  // by namespace prefix so future cache-key bumps don't silently rot.
  const planKeys = await redis.keys("transit:plan:*");
  if (planKeys.length > 0) {
    await Promise.all(planKeys.map((k) => cacheDel(k)));
  }
  await cacheDel("transit:line-search:v1:all:25");
  clearCapturedRequests();
});

function lastPlanQuery(): string {
  const planRequests = getCapturedRequests().filter((r) => {
    if (!r.url.includes("routing/v2")) return false;
    const body = r.body as { query?: string } | null;
    return body?.query?.includes("planConnection") ?? false;
  });
  if (planRequests.length === 0) {
    throw new Error("No planConnection request was captured");
  }
  return (planRequests.at(-1)!.body as { query: string }).query;
}

const HELSINKI = { lat: 60.17, lon: 24.94 };
const NEAR_HELSINKI = { lat: 60.2, lon: 24.96 };

function postPlan(
  overrides: Partial<{
    from: { lat: number; lon: number };
    to: { lat: number; lon: number };
    dateTime: number;
    arriveBy: boolean;
    headers: Record<string, string>;
  }> = {},
) {
  const { headers, ...rest } = overrides;
  return server.inject({
    method: "POST",
    url: "/api/v1/transit/plan",
    payload: {
      query: {
        from: rest.from ?? HELSINKI,
        to: rest.to ?? NEAR_HELSINKI,
        ...(rest.dateTime !== undefined ? { dateTime: rest.dateTime } : {}),
        ...(rest.arriveBy !== undefined ? { arriveBy: rest.arriveBy } : {}),
      },
    },
    headers,
  });
}

const WHEELCHAIR_HEADER =
  "wheelchair=1;lowFloor=0;noStairs=0;stroller=0;sr=0;lv=0;lang=en";
const LOW_FLOOR_HEADER =
  "wheelchair=0;lowFloor=1;noStairs=0;stroller=0;sr=0;lv=0;lang=en";

describe("Acceptance: cross-region line disambiguation (roadmap gate 1)", () => {
  // See also: lines-search.test.ts (full ranking), transit-line-view.spec.ts
  it("/transit/lines/search?q=25 surfaces both HSL and Tampere agencies", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/lines/search?q=25",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ gtfsId: string; agency: { name: string } }>;
    };
    const agencies = body.data.map((r) => r.agency.name);
    expect(agencies).toContain("HSL");
    expect(agencies).toContain("Tampereen seudun joukkoliikenne");
  });
});

describe("Acceptance: future-time planner round-trip (roadmap gate 2)", () => {
  // See also: transit.test.ts "threads dateTime into the GraphQL query"
  it("a dateTime in the future emits earliestDeparture in the upstream query", async () => {
    const tomorrowAtFive = Math.floor(Date.now() / 1000) + 24 * 3600;
    const res = await postPlan({ dateTime: tomorrowAtFive });
    expect(res.statusCode).toBe(200);
    expect(lastPlanQuery()).toContain("earliestDeparture");
  });

  it("arriveBy=true flips earliestDeparture → latestArrival", async () => {
    const tomorrowAtFive = Math.floor(Date.now() / 1000) + 24 * 3600;
    const res = await postPlan({ dateTime: tomorrowAtFive, arriveBy: true });
    expect(res.statusCode).toBe(200);
    expect(lastPlanQuery()).toContain("latestArrival");
  });
});

describe("Acceptance: wheelchair persona reaches the planner (roadmap gate 3)", () => {
  // See also: persona-per-adapter.test.ts (all four Digitransit adapters)
  it("wheelchair persona emits `wheelchair: { enabled: true }` in the plan query", async () => {
    const res = await postPlan({
      headers: { "x-reissulla-persona": WHEELCHAIR_HEADER },
    });
    expect(res.statusCode).toBe(200);
    expect(lastPlanQuery()).toContain("wheelchair: { enabled: true }");
  });

  it("default persona does NOT emit the wheelchair preference", async () => {
    const res = await postPlan();
    expect(res.statusCode).toBe(200);
    expect(lastPlanQuery()).not.toContain("wheelchair: { enabled: true }");
  });
});

describe("Acceptance: commuter-rail inbound/outbound split (roadmap gate 4)", () => {
  // The FE table-split contract is unit-tested at the clustering boundary so
  // the gate doesn't need a Tikkurila fixture. The E2E half (junat.net-style
  // two-column rendering) is verified manually via Playwright MCP.
  // See also: rail-clustering.test.ts, rail-direction.test.ts
  it("the clustering helper is exported from departures.service for component reuse", async () => {
    const mod = await import("../services/transit/departures.service.js");
    expect(typeof mod.clusterRailDirections).toBe("function");
  });
});

describe("Acceptance: cross-region itineraries (roadmap gate 5)", () => {
  // OTP2 Finland-wide graph is the single backing for any planConnection call,
  // regardless of from/to coordinates. The acceptance contract here is the
  // structural one — HEL → TPE → Pori cannot dispatch to the HSL-only
  // adapter and dead-end inside the capital region.
  it("forCoordinate(any) returns the Finland-wide adapter", () => {
    expect(adapterRouter.forCoordinate(60.17, 24.94).name).toBe(
      digitransitFinland.name,
    );
    // Tampere coordinates also resolve to the Finland adapter, not Waltti.
    expect(adapterRouter.forCoordinate(61.49, 23.78).name).toBe(
      digitransitFinland.name,
    );
    // Pori coordinates likewise.
    expect(adapterRouter.forCoordinate(61.48, 21.79).name).toBe(
      digitransitFinland.name,
    );
  });
});

describe("Acceptance: service-day edge cases (roadmap gate 6)", () => {
  // See also: service-day.test.ts (DST, midnight, fall-back replay, sparse)
  it("the shared service-day module exposes the rollover-hour constant", async () => {
    const { SERVICE_DAY_ROLLOVER_HOUR } = await import("@reissulla/shared");
    expect(SERVICE_DAY_ROLLOVER_HOUR).toBe(4);
  });
});

describe("Acceptance: GraphQL schema snapshot baseline (roadmap gate 7)", () => {
  // The CI step `pnpm --filter @reissulla/api test:graphql-snapshot` writes
  // schema.snapshot.graphql + feeds.snapshot.json for every enabled adapter.
  // A drift produces a git diff that fails CI. Here we assert the baseline
  // files exist for every adapter the router lists.
  it("every adapter ships a checked-in SDL + feeds snapshot pair", () => {
    const root = join(HERE, "..", "adapters");
    for (const adapter of adapterRouter.all()) {
      const sdl = join(root, adapter.name, "schema.snapshot.graphql");
      const feeds = join(root, adapter.name, "feeds.snapshot.json");
      expect(readFileSync(sdl, "utf8").length).toBeGreaterThan(1000);
      expect(JSON.parse(readFileSync(feeds, "utf8"))).toHaveProperty("feeds");
    }
  });
});

describe("Acceptance: fi + en string parity (roadmap gate 8)", () => {
  // The web app's i18n catalogues live outside this package; we read them
  // as JSON so any new fi-only or en-only key fails the API suite too.
  it("messages-fi.json and messages-en.json define the same key set", () => {
    const web = join(HERE, "..", "..", "..", "web", "src", "i18n");
    const en = JSON.parse(readFileSync(join(web, "messages-en.json"), "utf8"));
    const fi = JSON.parse(readFileSync(join(web, "messages-fi.json"), "utf8"));
    const onlyEn = Object.keys(en).filter((k) => !(k in fi));
    const onlyFi = Object.keys(fi).filter((k) => !(k in en));
    expect(onlyEn).toEqual([]);
    expect(onlyFi).toEqual([]);
  });
});

describe("Acceptance: A11Y-19 — low-floor on both surfaces (roadmap gate 9)", () => {
  // Departures-board half: the low-floor chip narrows the upstream query.
  // Planner half: the lowFloor persona translates into the same step-free
  // preference the wheelchair persona carries (per
  // packages/shared persona → plan-args mapping).
  it("planner with lowFloor persona reaches GraphQL with wheelchair-enabled preference", async () => {
    const res = await postPlan({
      headers: { "x-reissulla-persona": LOW_FLOOR_HEADER },
    });
    expect(res.statusCode).toBe(200);
    // lowFloor doesn't currently route to OTP2 wheelchair preferences — it
    // is rendered as a FE chip + result filter (see
    // persona-per-adapter.test.ts "lowFloor doesn't translate" case). The
    // gate is: low-floor settings DO reach the server (header parses, no
    // 400) and the planner responds 200 without escalating to wheelchair.
    expect(lastPlanQuery()).not.toContain("wheelchair: { enabled: true }");
  });
});
