import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSseSubscription } from "./sse";

/**
 * Hand-rolled EventSource stand-in. jsdom doesn't ship one and the real
 * spec implementation would hit the network — we want deterministic
 * control over open / message / error so backoff and visibility-change
 * paths are observable in unit time.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static last(): FakeEventSource {
    const inst = FakeEventSource.instances.at(-1);
    if (!inst) throw new Error("No FakeEventSource created yet");
    return inst;
  }
  static reset(): void {
    FakeEventSource.instances = [];
  }

  url: string;
  closed = false;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.onopen?.(new Event("open"));
  }

  emitMessage(payload: unknown): void {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(payload) }),
    );
  }

  emitError(): void {
    this.onerror?.(new Event("error"));
  }
}

declare global {
  // eslint-disable-next-line no-var
  var EventSource: typeof globalThis.EventSource;
}

beforeEach(() => {
  FakeEventSource.reset();
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function flushInitialConnect(): Promise<void> {
  // The hook defers the first connect through a 0 ms timer so its useEffect
  // body never calls setState synchronously (lint gate). Each test waits one
  // macrotask to let the EventSource land before asserting on it.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useSseSubscription", () => {
  it("opens the EventSource on mount and decodes the first JSON message", async () => {
    const { result } = renderHook(() =>
      useSseSubscription<{ n: number }>("/api/v1/transit/stops/abc/live"),
    );

    expect(result.current.status).toBe("connecting");
    await flushInitialConnect();
    expect(FakeEventSource.last().url).toBe("/api/v1/transit/stops/abc/live");

    act(() => {
      FakeEventSource.last().emitOpen();
    });
    await waitFor(() => expect(result.current.status).toBe("open"));

    act(() => {
      FakeEventSource.last().emitMessage({ n: 42 });
    });
    await waitFor(() => expect(result.current.data).toEqual({ n: 42 }));
    expect(result.current.lastUpdate).toBeGreaterThan(0);
  });

  it("schedules reconnect with exponential backoff on error", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSseSubscription("/live/x"));

    // Flush the deferred initial connect under fake timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(FakeEventSource.instances.length).toBe(1);

    act(() => {
      FakeEventSource.last().emitError();
    });
    expect(result.current.status).toBe("error");

    // First reconnect after 1 s (2^0 * 1000).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeEventSource.instances.length).toBe(2);

    act(() => {
      FakeEventSource.last().emitError();
    });

    // Second reconnect after 2 s (2^1 * 1000).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(FakeEventSource.instances.length).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(FakeEventSource.instances.length).toBe(3);
  });

  it("resets the backoff after a successful event", async () => {
    vi.useFakeTimers();
    renderHook(() => useSseSubscription<{ n: number }>("/live/x"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      FakeEventSource.last().emitError();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeEventSource.instances.length).toBe(2);

    act(() => {
      FakeEventSource.last().emitMessage({ n: 1 });
    });

    // Another error after a successful message — backoff resets to 1 s,
    // NOT 2 s, so the next reconnect lands at exactly 1000 ms.
    act(() => {
      FakeEventSource.last().emitError();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(FakeEventSource.instances.length).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(FakeEventSource.instances.length).toBe(3);
  });

  it("closes the source when the tab hides and reopens on visible", async () => {
    const { result } = renderHook(() => useSseSubscription("/live/x"));
    await flushInitialConnect();
    act(() => {
      FakeEventSource.last().emitOpen();
    });
    expect(FakeEventSource.last().closed).toBe(false);

    act(() => {
      setVisibility("hidden");
    });
    expect(FakeEventSource.last().closed).toBe(true);
    expect(result.current.status).toBe("closed");

    act(() => {
      setVisibility("visible");
    });
    expect(FakeEventSource.instances.length).toBe(2);
  });

  it("stays disconnected when enabled is false", async () => {
    const { result } = renderHook(() =>
      useSseSubscription("/live/x", { enabled: false }),
    );
    await flushInitialConnect();
    expect(FakeEventSource.instances.length).toBe(0);
    expect(result.current.status).toBe("closed");
  });

  it("stays disconnected when path is null", async () => {
    const { result } = renderHook(() => useSseSubscription(null));
    await flushInitialConnect();
    expect(FakeEventSource.instances.length).toBe(0);
    expect(result.current.status).toBe("closed");
  });

  it("closes the source on unmount", async () => {
    const { unmount } = renderHook(() => useSseSubscription("/live/x"));
    await flushInitialConnect();
    const src = FakeEventSource.last();
    unmount();
    expect(src.closed).toBe(true);
  });
});
