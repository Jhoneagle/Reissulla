import { describe, it, expect, afterEach } from "vitest";
import type { LineVehiclesEvent, VehiclePosition } from "@reissulla/shared";
import { config } from "../config.js";
import type { DigitransitMqttAdapter } from "../adapters/digitransit-mqtt/index.js";
import { startLineVehiclesPoller } from "../services/realtime/channels/line-vehicles.channel.js";
import { registry } from "../services/realtime/index.js";

const original = { ...config };
afterEach(() => {
  Object.assign(config, original);
});

function vehicle(vehicleId: string): VehiclePosition {
  return {
    vehicleId,
    routeId: "HSL:1058",
    lat: 60.17,
    lon: 24.94,
    delaySeconds: null,
    ts: Date.now(),
  };
}

/** Adapter stand-in that hands the channel's callbacks back to the test. */
function fakeAdapter() {
  let onMessage: ((v: VehiclePosition) => void) | null = null;
  let onStatus: ((s: { degraded: boolean }) => void) | null = null;
  let unsubbed = false;
  const adapter: DigitransitMqttAdapter = {
    subscribeVehicles(_filter, m, s) {
      onMessage = m;
      onStatus = s ?? null;
      return () => {
        unsubbed = true;
      };
    },
  };
  return {
    adapter,
    push: (v: VehiclePosition) => onMessage?.(v),
    setStatus: (s: { degraded: boolean }) => onStatus?.(s),
    get unsubbed() {
      return unsubbed;
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("line-vehicles channel", () => {
  it("publishes the accumulated vehicle set as a snapshot", async () => {
    config.realtimeVehiclePublishMs = 5;
    config.realtimeVehicleStaleMs = 60_000;
    const f = fakeAdapter();
    const controller = new AbortController();
    const events: LineVehiclesEvent[] = [];

    startLineVehiclesPoller("HSL:1058", (e) => events.push(e), controller, {
      adapter: f.adapter,
      cacheWrite: () => {},
      cachePrime: async () => [],
    });

    f.push(vehicle("22/1"));
    f.push(vehicle("22/2"));

    await waitFor(() => events.length >= 1);
    controller.abort();

    const last = events.at(-1)!;
    expect(last.vehicles.map((v) => v.vehicleId).sort()).toEqual([
      "22/1",
      "22/2",
    ]);
    expect(last.freshness.degraded).toBe(false);
    expect(f.unsubbed).toBe(true);
  });

  it("stamps freshness.degraded when the adapter reports degraded", async () => {
    config.realtimeVehiclePublishMs = 5;
    config.realtimeVehicleStaleMs = 60_000;
    const f = fakeAdapter();
    const controller = new AbortController();
    const events: LineVehiclesEvent[] = [];

    startLineVehiclesPoller("HSL:1058", (e) => events.push(e), controller, {
      adapter: f.adapter,
      cacheWrite: () => {},
      cachePrime: async () => [],
    });

    f.push(vehicle("22/9"));
    f.setStatus({ degraded: true });

    await waitFor(() => events.some((e) => e.freshness.degraded));
    controller.abort();
  });

  it("primes the first snapshot from the sliding cache", async () => {
    config.realtimeVehiclePublishMs = 5;
    config.realtimeVehicleStaleMs = 60_000;
    const f = fakeAdapter();
    const controller = new AbortController();
    const events: LineVehiclesEvent[] = [];

    startLineVehiclesPoller("HSL:1058", (e) => events.push(e), controller, {
      adapter: f.adapter,
      cacheWrite: () => {},
      cachePrime: async () => [vehicle("cached/1")],
    });

    await waitFor(() =>
      events.some((e) => e.vehicles.some((v) => v.vehicleId === "cached/1")),
    );
    controller.abort();
  });

  it("registers a line channel factory on the singleton registry", () => {
    expect(() => registry.get("line:HSL:1058")).not.toThrow();
  });
});
