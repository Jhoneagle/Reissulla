import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { digitransitRouting } from "@reissulla/test-fixtures";
import {
  getCapturedRequests,
  clearCapturedRequests,
} from "../../test/msw/request-log.js";

const { LINE_DEPARTURES_SCENARIO } = digitransitRouting;

let server: FastifyInstance;

beforeAll(async () => {
  server = await buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  await redis.quit();
});

async function clearCachesFor(gtfsId: string) {
  await cacheDel(`transit:line:v1:${gtfsId}`);
  await cacheDel(`transit:line-departures:v2:${gtfsId}:any`);
  await cacheDel(`transit:line-departures:v2:${gtfsId}:0`);
}

describe("GET /api/v1/transit/lines/:gtfsId/departures", () => {
  beforeEach(async () => {
    for (const id of Object.values(LINE_DEPARTURES_SCENARIO)) {
      await clearCachesFor(id);
    }
    clearCapturedRequests();
  });

  it("returns one row per pattern stop with the next departure for the line", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/lines/${LINE_DEPARTURES_SCENARIO.DEFAULT}/departures?direction=0`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].stop.gtfsId).toBe("HSL:STOP_A");
    expect(body.data[1].stop.gtfsId).toBe("HSL:STOP_B");
    expect(body.data[0].nextDepartureUnix).toBe(1778100000 + 43030);
    expect(body.data[0].realtime).toBe(true);
    expect(body.data[0].delaySec).toBe(30);
  });

  it("returns null fields when a stop has no upcoming line departures", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/lines/${LINE_DEPARTURES_SCENARIO.STOP_A_EMPTY}/departures?direction=0`,
    });

    const body = res.json();
    expect(body.data[0].nextDepartureUnix).toBeNull();
    expect(body.data[0].scheduledDepartureUnix).toBeNull();
    expect(body.data[0].delaySec).toBe(0);
    expect(body.data[0].realtime).toBe(false);
    // The second stop still produces a real row from the same single
    // upstream response — proves the projection isn't all-or-nothing.
    expect(body.data[1].nextDepartureUnix).toBe(1778100000 + 43800);
  });

  it("caches the resulting per-line projection", async () => {
    await server.inject({
      method: "GET",
      url: `/api/v1/transit/lines/${LINE_DEPARTURES_SCENARIO.CACHED}/departures?direction=0`,
    });
    const callsAfterFirst = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    ).length;

    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/lines/${LINE_DEPARTURES_SCENARIO.CACHED}/departures?direction=0`,
    });
    expect(
      getCapturedRequests().filter((r) => r.url.includes("routing/v2")).length,
    ).toBe(callsAfterFirst);
    expect(res.json().cached).toBe(true);
  });

  it("picks the chronologically earliest stoptime even when upstream returns them out of order", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/api/v1/transit/lines/${LINE_DEPARTURES_SCENARIO.OUT_OF_ORDER}/departures?direction=0`,
    });

    const body = res.json();
    expect(body.data[0].nextDepartureUnix).toBe(1778100000 + 43000);
  });

  it("issues exactly one departures fetch regardless of stop count", async () => {
    await server.inject({
      method: "GET",
      url: `/api/v1/transit/lines/${LINE_DEPARTURES_SCENARIO.SINGLE_FETCH}/departures?direction=0`,
    });

    // Exactly two upstream hits: getLine (route + patterns) plus the
    // single line-departures call. The pre-rewrite fan-out would have
    // produced 1 + N stop calls for an N-stop pattern.
    const routingCalls = getCapturedRequests().filter((r) =>
      r.url.includes("routing/v2"),
    );
    expect(routingCalls.length).toBe(2);
  });
});
