import { describe, it, expect } from "vitest";
import { InMemoryBus } from "../services/realtime/bus.js";

describe("InMemoryBus", () => {
  it("delivers an event published after subscribe", async () => {
    const bus = new InMemoryBus();
    const received: unknown[] = [];
    const unsub = bus.subscribe("stop:HSL:1040601", (e) => received.push(e));

    await bus.publish("stop:HSL:1040601", { hello: "world" });

    expect(received).toEqual([{ hello: "world" }]);
    unsub();
  });

  it("delivers events to every subscriber on the same key", async () => {
    const bus = new InMemoryBus();
    const a: unknown[] = [];
    const b: unknown[] = [];
    bus.subscribe("stop:HSL:1040601", (e) => a.push(e));
    bus.subscribe("stop:HSL:1040601", (e) => b.push(e));

    await bus.publish("stop:HSL:1040601", "ping");

    expect(a).toEqual(["ping"]);
    expect(b).toEqual(["ping"]);
  });

  it("does not cross-deliver between distinct keys", async () => {
    const bus = new InMemoryBus();
    const stopEvents: unknown[] = [];
    const lineEvents: unknown[] = [];
    bus.subscribe("stop:HSL:1040601", (e) => stopEvents.push(e));
    bus.subscribe("line:HSL:1014", (e) => lineEvents.push(e));

    await bus.publish("stop:HSL:1040601", "for-stop");
    await bus.publish("line:HSL:1014", "for-line");

    expect(stopEvents).toEqual(["for-stop"]);
    expect(lineEvents).toEqual(["for-line"]);
  });

  it("stops delivering after unsubscribe", async () => {
    const bus = new InMemoryBus();
    const received: unknown[] = [];
    const unsub = bus.subscribe("alerts:anon", (e) => received.push(e));

    await bus.publish("alerts:anon", "first");
    unsub();
    await bus.publish("alerts:anon", "second");

    expect(received).toEqual(["first"]);
  });

  it("events published before any subscriber are dropped (fire-and-forget)", async () => {
    const bus = new InMemoryBus();
    await bus.publish("stop:HSL:1040601", "pre");
    const received: unknown[] = [];
    bus.subscribe("stop:HSL:1040601", (e) => received.push(e));

    expect(received).toEqual([]);
  });
});
