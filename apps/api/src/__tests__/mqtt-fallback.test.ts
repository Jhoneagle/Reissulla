import { describe, it, expect, afterEach, vi } from "vitest";
import type { VehiclePosition } from "@reissulla/shared";
import { config } from "../config.js";
import { createDigitransitMqttAdapter } from "../adapters/digitransit-mqtt/index.js";

const original = { ...config };
afterEach(() => {
  Object.assign(config, original);
  vi.restoreAllMocks();
});

function vehicle(vehicleId: string): VehiclePosition {
  return {
    vehicleId,
    routeId: "HSL:1058",
    lat: 60.17,
    lon: 24.94,
    delaySeconds: null,
    ts: 1_730_000_000_000,
  };
}

/** Minimal EventEmitter-shaped stand-in for an mqtt client. */
function fakeMqttClient() {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  const subscribed: string[] = [];
  return {
    subscribed,
    ended: false,
    on(event: string, handler: (...a: unknown[]) => void) {
      (handlers[event] ??= []).push(handler);
      return this;
    },
    emit(event: string, ...args: unknown[]) {
      for (const h of handlers[event] ?? []) h(...args);
    },
    subscribe(topic: string) {
      subscribed.push(topic);
    },
    end() {
      this.ended = true;
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

describe("digitransit-mqtt fallback", () => {
  it("serves the polled fallback (degraded) when no broker is configured", async () => {
    config.mqttBrokerUrl = "";
    config.realtimeVehicleFallbackPollMs = 5;
    const pollFallback = vi.fn().mockResolvedValue([vehicle("22/1")]);
    const adapter = createDigitransitMqttAdapter({ pollFallback });

    const received: VehiclePosition[] = [];
    const statuses: { degraded: boolean }[] = [];
    const unsub = adapter.subscribeVehicles(
      { route: "HSL:1058" },
      (v) => received.push(v),
      (s) => statuses.push(s),
    );

    await waitFor(() => received.length >= 1);
    unsub();

    expect(statuses[0]).toEqual({ degraded: true });
    expect(received[0]).toEqual(vehicle("22/1"));
    expect(pollFallback).toHaveBeenCalledWith(
      "HSL:1058",
      expect.any(AbortSignal),
    );
  });

  it("degrades to the polled fallback when the broker stays unreachable", async () => {
    config.mqttBrokerUrl = "wss://broker.invalid:443/";
    config.mqttFallbackAfterMs = 10;
    config.realtimeVehicleFallbackPollMs = 5;
    const client = fakeMqttClient();
    const connect = vi.fn(() => client as never);
    const pollFallback = vi.fn().mockResolvedValue([vehicle("22/2")]);
    const adapter = createDigitransitMqttAdapter({ connect, pollFallback });

    const received: VehiclePosition[] = [];
    const statuses: { degraded: boolean }[] = [];
    // Never emit "connect" — the unreachable timer should trip the fallback.
    const unsub = adapter.subscribeVehicles(
      { route: "HSL:1058" },
      (v) => received.push(v),
      (s) => statuses.push(s),
    );

    await waitFor(() => received.length >= 1);
    unsub();

    expect(connect).toHaveBeenCalledOnce();
    expect(statuses).toContainEqual({ degraded: true });
    expect(received[0]).toEqual(vehicle("22/2"));
    expect(client.ended).toBe(true);
  });

  it("clears degraded and subscribes once the broker connects", async () => {
    config.mqttBrokerUrl = "wss://broker.invalid:443/";
    config.mqttFallbackAfterMs = 10;
    config.realtimeVehicleFallbackPollMs = 5;
    const client = fakeMqttClient();
    const connect = vi.fn(() => client as never);
    const pollFallback = vi.fn().mockResolvedValue([vehicle("22/3")]);
    const adapter = createDigitransitMqttAdapter({ connect, pollFallback });

    const statuses: { degraded: boolean }[] = [];
    const unsub = adapter.subscribeVehicles(
      { route: "HSL:1058" },
      () => {},
      (s) => statuses.push(s),
    );

    await waitFor(() => statuses.some((s) => s.degraded));
    client.emit("connect");
    await waitFor(() => statuses.some((s) => !s.degraded));
    unsub();

    expect(client.subscribed).toEqual([
      "/hfp/v2/journey/ongoing/vp/+/+/+/1058/#",
    ]);
    expect(statuses.at(-1)).toEqual({ degraded: false });
  });
});
