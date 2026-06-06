import type { FrequencyBand } from "@reissulla/shared";

/**
 * Pure aggregation of seconds-of-service-day departure offsets into the
 * editorial FrequencyBand[] the LineView strip renders. No clock-time
 * reasoning here — the caller supplies the offsets already sorted; bucket
 * indices are hours-of-service-day (so a DST 25h day naturally lands in
 * bucket 24 without negative-headway artefacts).
 *
 * Algorithm:
 *   1. ≤ 4 trips for the whole day → sparse-day collapse, one synthetic
 *      band with `headwayMin = -1` sentinel + literal HH:mm tripTimes.
 *   2. Otherwise bucket by hour-of-service-day; compute per-bucket
 *      headway as the average gap between consecutive departures
 *      (count≥3) or the single gap (count===2). Buckets with <2 trips
 *      are skipped — they don't represent a coherent "service".
 *   3. Merge adjacent buckets whose headways differ by ≤25%. The
 *      surviving headway is the trip-count-weighted average across the
 *      merged buckets.
 *
 * `headwayMin` is rounded to integer minutes for stable FE rendering.
 */
export function deriveFrequencyBands(
  departureOffsetsSec: number[],
): FrequencyBand[] {
  if (departureOffsetsSec.length === 0) return [];

  // Sparse-day collapse — 4 or fewer departures across the whole service
  // day isn't a "rhythm", it's a printed timetable list. The sentinel keeps
  // the wire shape flat (FrequencyBand[]) instead of forking the type.
  if (departureOffsetsSec.length <= 4) {
    return [
      {
        fromTimeOfDay: "00:00",
        toTimeOfDay: "24:00",
        headwayMin: -1,
        tripCount: departureOffsetsSec.length,
        tripTimes: departureOffsetsSec.map(formatTimeOfDay),
      },
    ];
  }

  // Bucket by hour-of-service-day. Keys may exceed 23 on DST 25h days.
  const buckets = new Map<number, number[]>();
  for (const offset of departureOffsetsSec) {
    const hour = Math.floor(offset / 3600);
    const list = buckets.get(hour) ?? [];
    list.push(offset);
    buckets.set(hour, list);
  }

  // Compute one band per qualifying bucket (count ≥ 2).
  interface RawBand {
    startHour: number;
    endHour: number;
    headwayMin: number;
    tripCount: number;
  }
  const rawBands: RawBand[] = [];
  const sortedHours = [...buckets.keys()].sort((a, b) => a - b);
  for (const hour of sortedHours) {
    const offsets = buckets.get(hour)!;
    if (offsets.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < offsets.length; i++) {
      gaps.push(offsets[i]! - offsets[i - 1]!);
    }
    const avgGapSec = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    rawBands.push({
      startHour: hour,
      endHour: hour,
      headwayMin: Math.round(avgGapSec / 60),
      tripCount: offsets.length,
    });
  }

  if (rawBands.length === 0) return [];

  // Merge adjacent bands whose headways are within 25% of each other.
  // Adjacency keys off `endHour`, not `startHour` — after a merge the
  // band's reach extends to the absorbed bucket's hour, and the next
  // bucket needs to be adjacent to *that*, not to the (now-distant) start.
  // Non-adjacent hours (gaps in service) are never merged so the FE
  // renders a visible gap.
  const merged: RawBand[] = [];
  let current: RawBand = { ...rawBands[0]! };
  for (let i = 1; i < rawBands.length; i++) {
    const next = rawBands[i]!;
    const isAdjacent = next.startHour === current.endHour + 1;
    const tighter = Math.min(current.headwayMin, next.headwayMin);
    const wider = Math.max(current.headwayMin, next.headwayMin);
    const within25 = tighter > 0 && (wider - tighter) / tighter <= 0.25;
    if (isAdjacent && within25) {
      const totalTrips = current.tripCount + next.tripCount;
      current = {
        startHour: current.startHour,
        endHour: next.endHour,
        headwayMin: Math.round(
          (current.headwayMin * current.tripCount +
            next.headwayMin * next.tripCount) /
            totalTrips,
        ),
        tripCount: totalTrips,
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged.map<FrequencyBand>((band) => ({
    fromTimeOfDay: formatHour(band.startHour),
    toTimeOfDay: formatHour(band.endHour + 1),
    headwayMin: band.headwayMin,
    tripCount: band.tripCount,
  }));
}

function formatHour(hourOfServiceDay: number): string {
  const h = hourOfServiceDay.toString().padStart(2, "0");
  return `${h}:00`;
}

function formatTimeOfDay(offsetSec: number): string {
  const hours = Math.floor(offsetSec / 3600);
  const minutes = Math.floor((offsetSec % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}
