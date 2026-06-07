import { describe, it, expect } from "vitest";
import {
  adjustWalkDuration,
  impactFromSurfaceState,
} from "../services/weather/road-impact.service.js";
import type { RoadCondition } from "../adapters/fintraffic/types.js";

describe("impactFromSurfaceState", () => {
  it("returns null for dry surface (no walking penalty)", () => {
    expect(impactFromSurfaceState("dry")).toBeNull();
  });

  it("returns null when surface state is unknown", () => {
    expect(impactFromSurfaceState(null)).toBeNull();
  });

  it("flags icy as the slowest reasonable walker hint", () => {
    const impact = impactFromSurfaceState("icy");
    expect(impact).not.toBeNull();
    expect(impact!.reason).toBe("ice");
    expect(impact!.multiplier).toBeGreaterThan(1.1);
  });

  it("penalises partly-icy slightly less than fully icy", () => {
    const icy = impactFromSurfaceState("icy")!;
    const partly = impactFromSurfaceState("partly-icy")!;
    expect(partly.multiplier).toBeLessThan(icy.multiplier);
    expect(partly.reason).toBe("partly-ice");
  });

  it("penalises wet roads by a small amount", () => {
    const wet = impactFromSurfaceState("wet")!;
    expect(wet.reason).toBe("wet");
    expect(wet.multiplier).toBeGreaterThan(1);
    expect(wet.multiplier).toBeLessThan(1.05);
  });

  it("returns a reason for every non-dry surface state", () => {
    const states = [
      "wet",
      "moist-salty",
      "frosty",
      "snowy",
      "icy",
      "partly-icy",
    ] as const;
    for (const state of states) {
      const impact = impactFromSurfaceState(state);
      expect(impact, `surface state ${state}`).not.toBeNull();
      expect(impact!.multiplier).toBeGreaterThan(1);
    }
  });
});

const condition = (
  surfaceState: RoadCondition["surfaceState"],
): RoadCondition => ({
  sectionId: 1,
  sectionName: "Test section",
  surfaceState,
  weather: null,
  roadTemperature: -2,
  distanceKm: 0.4,
  observedAt: "2026-01-01T00:00:00Z",
});

describe("adjustWalkDuration", () => {
  it("returns null when no road condition is available", () => {
    expect(adjustWalkDuration(300, null)).toBeNull();
  });

  it("returns null when the surface is dry", () => {
    expect(adjustWalkDuration(300, condition("dry"))).toBeNull();
  });

  it("returns null when the surface state is unknown", () => {
    expect(adjustWalkDuration(300, condition(null))).toBeNull();
  });

  it("rounds the adjusted duration to whole seconds", () => {
    const adjusted = adjustWalkDuration(300, condition("icy"));
    expect(adjusted).not.toBeNull();
    expect(adjusted!.baseDuration).toBe(300);
    // 300 * 1.15 = 345; should be an integer, not a float.
    expect(adjusted!.duration).toBe(345);
    expect(Number.isInteger(adjusted!.duration)).toBe(true);
  });

  it("preserves the baseline duration separately from the adjusted one", () => {
    const adjusted = adjustWalkDuration(600, condition("snowy"))!;
    expect(adjusted.baseDuration).toBe(600);
    expect(adjusted.duration).toBeGreaterThan(adjusted.baseDuration);
    expect(adjusted.impact.reason).toBe("snow");
  });
});
