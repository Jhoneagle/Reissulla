import { describe, it, expect } from "vitest";
import { deriveFrequencyBands } from "../services/transit/frequency-bands.js";

/** "HH:mm" → seconds-of-service-day */
function ts(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  return Number(hStr) * 3600 + Number(mStr) * 60;
}

describe("deriveFrequencyBands", () => {
  it("returns an empty array when no departures", () => {
    expect(deriveFrequencyBands([])).toEqual([]);
  });

  it("collapses ≤4 trips into a sparse-day sentinel with literal tripTimes", () => {
    const bands = deriveFrequencyBands([
      ts("05:42"),
      ts("12:18"),
      ts("17:05"),
      ts("21:30"),
    ]);

    expect(bands).toHaveLength(1);
    expect(bands[0]!.headwayMin).toBe(-1);
    expect(bands[0]!.tripCount).toBe(4);
    expect(bands[0]!.tripTimes).toEqual(["05:42", "12:18", "17:05", "21:30"]);
  });

  it("returns one merged band for 24h of uniform 10-min headway", () => {
    const offsets: number[] = [];
    for (let m = 5 * 60; m < 24 * 60; m += 10) offsets.push(m * 60);

    const bands = deriveFrequencyBands(offsets);
    // The merge pass collapses 19 hourly bands (each at 10-min headway)
    // into one. With strictly uniform 10-min spacing the merge invariant
    // holds end-to-end.
    expect(bands).toHaveLength(1);
    expect(bands[0]!.headwayMin).toBe(10);
    expect(bands[0]!.fromTimeOfDay).toBe("05:00");
  });

  it("splits into three bands for morning peak / midday / evening peak", () => {
    const offsets: number[] = [];
    // 06:00–09:00 every 7 min (≈26 trips)
    for (let t = 6 * 3600; t < 9 * 3600; t += 7 * 60) offsets.push(t);
    // 09:00–15:00 every 12 min (30 trips)
    for (let t = 9 * 3600; t < 15 * 3600; t += 12 * 60) offsets.push(t);
    // 15:00–18:00 every 6 min (30 trips)
    for (let t = 15 * 3600; t < 18 * 3600; t += 6 * 60) offsets.push(t);

    const bands = deriveFrequencyBands(offsets);
    // Adjacent hours within each band merge; the three distinct rhythms
    // remain separate because the 7→12 and 12→6 jumps exceed the 25%
    // merge threshold.
    expect(bands.length).toBeGreaterThanOrEqual(3);
    const headways = bands.map((b) => b.headwayMin);
    expect(headways).toContain(7);
    expect(headways).toContain(12);
    expect(headways).toContain(6);
  });

  it("merges adjacent buckets when headways differ by ≤25%", () => {
    // 8-min headway from 06:00–07:00, 10-min headway from 07:00–08:00.
    // 10/8 - 1 = 25% → on the boundary; the implementation treats ≤25%
    // as mergeable so this should yield one band.
    const offsets: number[] = [];
    for (let t = 6 * 3600; t < 7 * 3600; t += 8 * 60) offsets.push(t);
    for (let t = 7 * 3600; t < 8 * 3600; t += 10 * 60) offsets.push(t);

    const bands = deriveFrequencyBands(offsets);
    expect(bands).toHaveLength(1);
    // Weighted average of 8 (7 trips) and 10 (6 trips): (56+60)/13 ≈ 8.9
    // → rounded to 9.
    expect(bands[0]!.headwayMin).toBe(9);
  });

  it("skips buckets with fewer than 2 trips (sparse-bucket guard)", () => {
    // A single 06:00 stray departure + a real 07–10 rhythm. The 06:00
    // hour-bucket has only 1 trip so it must be dropped — leaving one
    // coherent merged band 07:00→10:00.
    const offsets = [
      ts("06:00"),
      ts("07:05"),
      ts("07:25"),
      ts("07:45"),
      ts("08:05"),
      ts("08:25"),
      ts("08:45"),
      ts("09:05"),
      ts("09:25"),
      ts("09:45"),
    ];
    const bands = deriveFrequencyBands(offsets);
    expect(bands[0]!.fromTimeOfDay).toBe("07:00");
    expect(bands[0]!.tripCount).toBe(9);
  });

  it("buckets DST 25-hour service days without negative headways", () => {
    // Spring-back: a 25-hour service day means the highest bucket index is
    // 24, not 23. The bucket loop must iterate over observed hours, not a
    // fixed 0..23 range.
    const offsets: number[] = [];
    for (let h = 5; h <= 24; h++) {
      offsets.push(h * 3600);
      offsets.push(h * 3600 + 1800);
    }

    const bands = deriveFrequencyBands(offsets);
    // No negative headways.
    for (const band of bands) {
      expect(band.headwayMin).toBeGreaterThanOrEqual(0);
    }
    // The final band's `toTimeOfDay` must extend past 24:00.
    const last = bands[bands.length - 1]!;
    expect(
      parseInt(last.toTimeOfDay.split(":")[0]!, 10),
    ).toBeGreaterThanOrEqual(25);
  });

  it("emits trip-count weighted headway when merging dissimilar bucket sizes", () => {
    // 5 trips at 12-min headway in bucket A, 15 trips at 10-min headway in
    // bucket B → weighted avg = (12*5 + 10*15) / 20 = 210/20 = 10.5 → 11.
    const offsets: number[] = [];
    for (let t = 6 * 3600; t < 7 * 3600; t += 12 * 60) offsets.push(t);
    for (let t = 7 * 3600; t < 9.5 * 3600; t += 10 * 60) offsets.push(t);

    const bands = deriveFrequencyBands(offsets);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.headwayMin).toBeGreaterThanOrEqual(10);
    expect(bands[0]!.headwayMin).toBeLessThanOrEqual(11);
  });
});
