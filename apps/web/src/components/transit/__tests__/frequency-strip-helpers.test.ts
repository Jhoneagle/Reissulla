import { describe, expect, it } from "vitest";
import type { FrequencyBand } from "@reissulla/shared";
import {
  barHeight,
  buildGridColumns,
  minutesBetween,
  rangeLabel,
} from "../frequency-strip-helpers";

function band(over: Partial<FrequencyBand> = {}): FrequencyBand {
  return {
    fromTimeOfDay: "06:00",
    toTimeOfDay: "09:00",
    headwayMin: 10,
    tripCount: 18,
    ...over,
  };
}

describe("frequency-strip helpers", () => {
  describe("minutesBetween", () => {
    it("returns the difference in minutes for same-day bands", () => {
      expect(
        minutesBetween(band({ fromTimeOfDay: "06:00", toTimeOfDay: "09:00" })),
      ).toBe(180);
    });

    it("wraps past midnight so late-night bands still get positive width", () => {
      expect(
        minutesBetween(band({ fromTimeOfDay: "23:00", toTimeOfDay: "02:00" })),
      ).toBe(180);
    });

    it("never returns below 1 so a band never collapses to 0fr", () => {
      expect(
        minutesBetween(band({ fromTimeOfDay: "12:00", toTimeOfDay: "12:00" })),
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe("barHeight", () => {
    it("returns the floor for non-positive headway (defensive)", () => {
      expect(barHeight(0)).toBe(40);
      expect(barHeight(-1)).toBe(40);
    });

    it("returns the ceiling for very dense headways (4 min)", () => {
      expect(barHeight(4)).toBe(96);
    });

    it("returns the floor for very sparse headways (30+ min)", () => {
      expect(barHeight(30)).toBe(40);
      expect(barHeight(60)).toBe(40);
    });

    it("scales inversely between bounds", () => {
      // 7 min < 15 min, so 7-min headway must yield a taller bar.
      expect(barHeight(7)).toBeGreaterThan(barHeight(15));
    });
  });

  describe("buildGridColumns", () => {
    it("returns proportional fr values that sum near 100", () => {
      const cols = buildGridColumns([
        band({ fromTimeOfDay: "06:00", toTimeOfDay: "09:00" }), // 180
        band({ fromTimeOfDay: "09:00", toTimeOfDay: "15:00" }), // 360
      ]);
      const parts = cols.split(" ").map((s) => parseFloat(s));
      expect(parts).toHaveLength(2);
      const total = parts[0]! + parts[1]!;
      expect(total).toBeGreaterThan(99.5);
      expect(total).toBeLessThan(100.5);
      // 360 min > 180 min → second column wider than first.
      expect(parts[1]!).toBeGreaterThan(parts[0]!);
    });

    it("falls back to equal columns when total duration is zero", () => {
      const cols = buildGridColumns([]);
      expect(cols).toBe("");
    });
  });

  describe("rangeLabel", () => {
    it("uses an en-dash between the two endpoints", () => {
      expect(
        rangeLabel(band({ fromTimeOfDay: "06:00", toTimeOfDay: "09:00" })),
      ).toBe("06:00–09:00");
    });
  });
});
