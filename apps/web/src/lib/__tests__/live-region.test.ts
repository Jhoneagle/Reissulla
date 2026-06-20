import { describe, expect, it } from "vitest";
import {
  createLiveAnnouncer,
  type ApproachPayload,
  type LiveAnnouncerOptions,
} from "../live-region";

/**
 * Deterministic harness: a manual clock + timer registry so the throttle and
 * coalesce windows are exercised without real time.
 */
function harness(opts: Partial<LiveAnnouncerOptions> = {}) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const emitted: ApproachPayload[][] = [];

  const announcer = createLiveAnnouncer({
    emit: (batch) => emitted.push(batch),
    now: () => now,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: now + ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (h) => {
      timers.delete(h as unknown as number);
    },
    ...opts,
  });

  function advance(ms: number) {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  }

  return {
    announce: announcer.announce,
    dispose: announcer.dispose,
    emitted,
    advance,
  };
}

function payload(
  route: string,
  over: Partial<ApproachPayload> = {},
): ApproachPayload {
  return {
    stopId: "STOP:1",
    stopName: "Rautatientori",
    routeShortName: route,
    headsign: "Munkkivuori",
    etaSeconds: 30,
    ...over,
  };
}

describe("createLiveAnnouncer", () => {
  it("emits at most one announcement for two events 5 s apart (15 s floor)", () => {
    const h = harness({ minIntervalMs: 15_000, coalesceMs: 2000 });

    h.announce(payload("14"));
    h.advance(2000); // coalesce window closes → first emit
    h.advance(3000); // t = 5 s
    h.announce(payload("14")); // within 15 s floor → dropped
    h.advance(5000);

    expect(h.emitted).toHaveLength(1);
  });

  it("coalesces multiple lines for one stop within the window into one batch", () => {
    const h = harness({ minIntervalMs: 15_000, coalesceMs: 2000 });

    h.announce(payload("14"));
    h.advance(1000); // still inside the 2 s window
    h.announce(payload("9"));
    h.advance(1000); // t = 2 s → flush

    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]!.map((p) => p.routeShortName)).toEqual(["14", "9"]);
  });

  it("dedupes a repeated route within the window, keeping the fresher payload", () => {
    const h = harness({ coalesceMs: 2000 });

    h.announce(payload("14", { etaSeconds: 50 }));
    h.advance(500);
    h.announce(payload("14", { etaSeconds: 20 }));
    h.advance(2000);

    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toHaveLength(1);
    expect(h.emitted[0]![0]!.etaSeconds).toBe(20);
  });

  it("honours a slower coalesce window (reading pace = slow → 4000 ms)", () => {
    const h = harness({ coalesceMs: 4000 });

    h.announce(payload("14"));
    h.advance(2000);
    expect(h.emitted).toHaveLength(0); // window not yet closed
    h.advance(2000); // t = 4 s → flush
    expect(h.emitted).toHaveLength(1);
  });

  it("keeps separate floors per stop", () => {
    const h = harness({ minIntervalMs: 15_000, coalesceMs: 1000 });

    h.announce(payload("14", { stopId: "STOP:A" }));
    h.announce(payload("9", { stopId: "STOP:B" }));
    h.advance(1000); // both windows close

    expect(h.emitted).toHaveLength(2);
  });
});
