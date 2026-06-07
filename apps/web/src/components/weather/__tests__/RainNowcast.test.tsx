import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThrottledText } from "../../../hooks/useThrottledText";

/**
 * Throttle the dashboard nowcast live region — the WAI-ARIA spec lets a
 * polite region announce as fast as the assistive tech can keep up. The
 * 15 s minimum gap is what keeps the dashboard from chattering at a
 * commuter who's only checking the screen for a moment.
 *
 * The full `<RainNowcast>` component just composes this hook with a
 * locale-resolved text from the snapshot data and renders the live
 * region. The composition itself is covered by the dashboard e2e.
 */

const STEP = 15_000;

function flushTimer(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useThrottledText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces the first non-empty value within one tick", () => {
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useThrottledText(text, STEP),
      { initialProps: { text: "" } },
    );
    expect(result.current).toBe("");
    rerender({ text: "Rain expected in about 30 minutes." });
    flushTimer(0);
    expect(result.current).toBe("Rain expected in about 30 minutes.");
  });

  it("holds an update that arrives within the throttle window", () => {
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useThrottledText(text, STEP),
      { initialProps: { text: "first" } },
    );
    flushTimer(0);
    expect(result.current).toBe("first");

    flushTimer(5_000);
    rerender({ text: "second" });
    flushTimer(0);
    expect(result.current).toBe("first");

    flushTimer(5_000);
    expect(result.current).toBe("first");
  });

  it("releases the held update after the throttle window elapses", () => {
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useThrottledText(text, STEP),
      { initialProps: { text: "first" } },
    );
    flushTimer(0);
    expect(result.current).toBe("first");
    rerender({ text: "second" });
    flushTimer(STEP);
    expect(result.current).toBe("second");
  });

  it("clears immediately when text drops to empty (no announce)", () => {
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useThrottledText(text, STEP),
      { initialProps: { text: "first" } },
    );
    flushTimer(0);
    expect(result.current).toBe("first");
    rerender({ text: "" });
    flushTimer(0);
    expect(result.current).toBe("");
  });
});
