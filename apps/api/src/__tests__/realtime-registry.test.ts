import { describe, it, expect, vi } from "vitest";
import { InMemoryBus } from "../services/realtime/bus.js";
import {
  createRegistry,
  registerChannelFactory,
  type ChannelFactory,
} from "../services/realtime/registry.js";

// Ensure all three default factories are registered before any registry
// builds a channel. Importing the barrel runs the side-effect registers.
import "../services/realtime/index.js";

describe("realtime channel registry", () => {
  it("subscribe / unsubscribe round-trip delivers a published event", async () => {
    const bus = new InMemoryBus();
    const registry = createRegistry(bus);
    const channel = registry.get<string>("stop:HSL:1040601");

    const received: string[] = [];
    const unsub = channel.subscribe((e) => received.push(e));

    await bus.publish("stop:HSL:1040601", "hello");
    expect(received).toEqual(["hello"]);

    unsub();
    await bus.publish("stop:HSL:1040601", "after-unsub");
    expect(received).toEqual(["hello"]);
  });

  it("starts the poller on first subscribe and aborts it on last unsubscribe", () => {
    // Replace the "line" factory with a probe so we can observe lifecycle.
    const startSpy = vi.fn();
    let capturedController: AbortController | null = null;
    const probe: ChannelFactory = () => ({
      start: (controller) => {
        capturedController = controller;
        startSpy();
      },
    });
    registerChannelFactory("line", probe);

    const bus = new InMemoryBus();
    const registry = createRegistry(bus);
    const channel = registry.get("line:HSL:1014");

    const u1 = channel.subscribe(() => {});
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(capturedController!.signal.aborted).toBe(false);

    // Second subscriber reuses the same poller — no re-start.
    const u2 = channel.subscribe(() => {});
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(registry.refCount("line:HSL:1014")).toBe(2);

    u1();
    expect(capturedController!.signal.aborted).toBe(false);
    expect(registry.refCount("line:HSL:1014")).toBe(1);

    u2();
    expect(capturedController!.signal.aborted).toBe(true);
    expect(registry.refCount("line:HSL:1014")).toBe(0);

    // Re-register the no-op stub so other tests aren't affected by the probe.
    registerChannelFactory("line", () => ({ start: () => {} }));
  });

  it("throws when no factory is registered for the channel-key prefix", () => {
    const bus = new InMemoryBus();
    const registry = createRegistry(bus);
    expect(() => registry.get("unknown:foo" as `stop:${string}`)).toThrow();
  });
});
