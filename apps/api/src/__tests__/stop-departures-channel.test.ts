import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TransitDeparture } from "@reissulla/shared";

vi.mock("../config.js", async () => {
  const actual =
    await vi.importActual<typeof import("../config.js")>("../config.js");
  return {
    config: { ...actual.config, realtimeStopPollMs: 5 },
  };
});

const getStopDeparturesMock = vi.fn();
vi.mock("../services/transit/departures.service.js", () => ({
  getStopDepartures: getStopDeparturesMock,
}));

// Force the channel module to re-register against the mocked deps each run.
async function importRealtime() {
  vi.resetModules();
  const registry = await import("../services/realtime/registry.js");
  await import("../services/realtime/channels/stop-departures.channel.js");
  const { InMemoryBus } = await import("../services/realtime/bus.js");
  return { ...registry, InMemoryBus };
}

function row(overrides: Partial<TransitDeparture> = {}): TransitDeparture {
  return {
    routeShortName: "550",
    routeLongName: "Itäkeskus(M)–Westendinasema",
    headsign: "Westendinasema",
    scheduledArrival: 36000,
    realtimeArrival: 36000,
    arrivalDelay: 0,
    scheduledDeparture: 36000,
    realtimeDeparture: 36000,
    departureDelay: 0,
    realtime: true,
    serviceDay: 1_730_000_000,
    vehicleMode: "BUS",
    tripId: "HSL:trip-a",
    ...overrides,
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timed out");
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("stop-departures channel", () => {
  beforeEach(() => {
    getStopDeparturesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes the first poll snapshot, then suppresses identical polls, then emits on a realtime delay change", async () => {
    const initial = [row({ departureDelay: 0 })];
    const same = [row({ departureDelay: 0 })];
    const delayed = [row({ departureDelay: 90 })];

    getStopDeparturesMock
      .mockResolvedValueOnce({ data: { departures: initial }, cached: false })
      .mockResolvedValueOnce({ data: { departures: same }, cached: true })
      .mockResolvedValueOnce({ data: { departures: delayed }, cached: false })
      // Subsequent ticks return the latest — no further changes — so the
      // channel can settle without leaking extra publishes into the count.
      .mockResolvedValue({ data: { departures: delayed }, cached: true });

    const { createRegistry, InMemoryBus } = await importRealtime();
    const bus = new InMemoryBus();
    const registry = createRegistry(bus);
    const received: TransitDeparture[][] = [];
    const channel = registry.get<TransitDeparture[]>("stop:HSL:1040601");
    const unsub = channel.subscribe((event) => received.push(event));

    await waitFor(() => received.length >= 2, 2000);
    unsub();

    expect(received.length).toBe(2);
    expect(received[0]).toEqual(initial);
    expect(received[1]).toEqual(delayed);
    expect(registry.refCount("stop:HSL:1040601")).toBe(0);
  });

  it("aborts the poller on last unsubscribe — no further upstream calls", async () => {
    getStopDeparturesMock.mockResolvedValue({
      data: { departures: [row()] },
      cached: false,
    });

    const { createRegistry, InMemoryBus } = await importRealtime();
    const bus = new InMemoryBus();
    const registry = createRegistry(bus);
    const channel = registry.get<TransitDeparture[]>("stop:HSL:abort-test");
    const unsub = channel.subscribe(() => {});

    await waitFor(() => getStopDeparturesMock.mock.calls.length >= 1, 1000);
    const callsBeforeUnsub = getStopDeparturesMock.mock.calls.length;
    unsub();

    // Give the poller enough wall clock to attempt a follow-up tick if the
    // abort didn't land. With a 5 ms poll cadence, 80 ms is ~16 missed ticks.
    await new Promise((r) => setTimeout(r, 80));

    const callsAfterWait = getStopDeparturesMock.mock.calls.length;
    expect(callsAfterWait - callsBeforeUnsub).toBeLessThanOrEqual(1);
  });
});
