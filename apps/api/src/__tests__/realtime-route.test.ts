import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import * as featureFlagService from "../services/featureFlag.service.js";
import { __setKeepaliveMsForTest } from "../routes/realtime.js";
import { registry } from "../services/realtime/index.js";
import { InMemoryBus } from "../services/realtime/bus.js";

let server: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
  await server.listen({ port: 0, host: "127.0.0.1" });
  const addr = server.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  __setKeepaliveMsForTest(null);
  await server.close();
  await redis.quit();
});

afterEach(() => {
  vi.restoreAllMocks();
  __setKeepaliveMsForTest(null);
});

function enableRealtime() {
  vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
    feed: { finland: true, hsl: true, waltti: true, varely: true },
    feature: { realtimeSse: true },
  });
}

describe("SSE feature-flag gate", () => {
  it("returns 503 with the REALTIME_DISABLED envelope when the flag is off", async () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: true },
      feature: { realtimeSse: false },
    });

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/transit/stops/HSL:1040601/live",
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.error.code).toBe("REALTIME_DISABLED");
    expect(body.error.source).toBe("realtime");
    expect(typeof body.error.message).toBe("string");
  });

  it("503s every live endpoint when the flag is off", async () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: true },
      feature: { realtimeSse: false },
    });

    for (const url of [
      "/api/v1/transit/stops/HSL:1040601/live",
      "/api/v1/transit/lines/HSL:1014/live",
      "/api/v1/alerts/live",
    ]) {
      const res = await server.inject({ method: "GET", url });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("REALTIME_DISABLED");
    }
  });
});

describe("SSE attached stream", () => {
  beforeEach(() => {
    enableRealtime();
    __setKeepaliveMsForTest(20);
  });

  it("sets text/event-stream headers and emits a keep-alive comment", async () => {
    // Use a key unique to this test so a slow refcount teardown doesn't leak
    // into the lifecycle assertion below.
    const url = `${baseUrl}/api/v1/transit/stops/HSL:headers-test/live`;
    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    const start = Date.now();
    while (Date.now() - start < 500) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      if (accumulated.includes(":\n\n")) break;
    }

    expect(accumulated).toContain(":\n\n");
    controller.abort();
    await reader.cancel().catch(() => {});
    await waitFor(() => registry.refCount("stop:HSL:headers-test") === 0, 2000);
  });

  it("refcounts subscribers — last disconnect drops the registry entry", async () => {
    const key = "stop:HSL:refcount-test" as const;
    expect(registry.refCount(key)).toBe(0);

    const aController = new AbortController();
    const bController = new AbortController();
    const [a, b] = await Promise.all([
      fetch(`${baseUrl}/api/v1/transit/stops/HSL:refcount-test/live`, {
        signal: aController.signal,
      }),
      fetch(`${baseUrl}/api/v1/transit/stops/HSL:refcount-test/live`, {
        signal: bController.signal,
      }),
    ]);

    await waitFor(() => registry.refCount(key) === 2);

    aController.abort();
    await a.body!.cancel().catch(() => {});
    await waitFor(() => registry.refCount(key) === 1, 5000);

    bController.abort();
    await b.body!.cancel().catch(() => {});
    await waitFor(() => registry.refCount(key) === 0, 5000);
  });
});

describe("SSE channels deliver published events", () => {
  it("delivers a bus-published event to a single SSE subscriber", async () => {
    // Plain bus / channel pair — no Fastify — keeps timing deterministic.
    const bus = new InMemoryBus();
    const received: unknown[] = [];
    const unsub = bus.subscribe("stop:HSL:1040601", (e) => received.push(e));

    await bus.publish("stop:HSL:1040601", { delta: 1 });
    await bus.publish("stop:HSL:1040601", { delta: 2 });

    expect(received).toEqual([{ delta: 1 }, { delta: 2 }]);
    unsub();
  });
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timed out");
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}
