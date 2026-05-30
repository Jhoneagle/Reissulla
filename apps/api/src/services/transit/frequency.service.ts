import {
  type Persona,
  type TransitDeparture,
  type TransitFrequency,
} from "@reissulla/shared";
import { fetchAndCacheTrip } from "./trip-cache.js";

/**
 * Classify how busy a stop's schedule is around the anchor time. Drives
 * the masthead kicker variant on the departure board (DEP-11):
 *
 * - `dense`: ≥10 departures in the next 60 minutes — urban hub.
 * - `moderate`: 3–9 departures in the next 60 minutes — suburban.
 * - `sparse`: ≤2 in the next 60 minutes OR next departure is >90 min
 *   away — rural / branch line / off-peak.
 *
 * Anchor is "now" or the future-time picker target (`anchorUnix`). The
 * window is the 60 minutes following the anchor. Decision is per-stop;
 * one stop can be sparse on a Sunday morning and dense at Monday
 * morning rush.
 */
export function classifyFrequency(
  departures: TransitDeparture[],
  anchorUnix: number,
): TransitFrequency | undefined {
  if (departures.length === 0) return undefined;

  // Project each departure to an absolute unix and discard rows in the
  // past relative to the anchor (the upstream `startTime` already
  // filters but the buffer can pull in earlier rows).
  const upcoming = departures
    .map((d) => ({
      unix: d.serviceDay + d.realtimeDeparture,
      departure: d,
    }))
    .filter((row) => row.unix >= anchorUnix)
    .sort((a, b) => a.unix - b.unix);

  if (upcoming.length === 0) return undefined;

  const next = upcoming[0]!;
  const oneHourWindow = upcoming.filter(
    (row) => row.unix - anchorUnix <= 60 * 60,
  );
  const nextHourCount = oneHourWindow.length;

  const avgIntervalMin =
    nextHourCount >= 2
      ? Math.round(
          (oneHourWindow[oneHourWindow.length - 1]!.unix -
            oneHourWindow[0]!.unix) /
            60 /
            (oneHourWindow.length - 1),
        )
      : undefined;

  const timeToNextMin = (next.unix - anchorUnix) / 60;

  let regime: TransitFrequency["regime"];
  if (timeToNextMin > 90 || nextHourCount <= 2) {
    regime = "sparse";
  } else if (nextHourCount < 10) {
    regime = "moderate";
  } else {
    regime = "dense";
  }

  return {
    regime,
    nextHourCount,
    avgIntervalMin,
    // nextDepartureUnix is most useful for sparse — the FE kicker
    // renders "Seuraava huomenna 06.45" verbatim from this.
    nextDepartureUnix: regime === "sparse" ? next.unix : undefined,
  };
}

/**
 * Derive a Finnish day-type qualifier from a trip's GTFS `activeDates`.
 * The qualifier appears in the kicker for sparse-frequency stops as
 * "Arkisin" / "Viikonloppuisin" / "Päivittäin" / "Erikoisliikenne".
 *
 * The classification is structural — counts weekday vs weekend
 * representation across the next 30 days of activity. Schooldays
 * detection (excluding summer / Christmas) is intentionally out of
 * scope here; it requires a Finnish school-calendar lookup that
 * doesn't justify its weight for a single kicker line.
 */
export function deriveServiceNoteFromActiveDates(
  activeDates: string[],
): string | undefined {
  if (activeDates.length === 0) return undefined;

  // YYYYMMDD → 0=Sun..6=Sat. Use UTC arithmetic since the date label
  // is just a key, not a wall-clock moment.
  function dayOfWeek(yyyymmdd: string): number {
    const y = Number(yyyymmdd.slice(0, 4));
    const m = Number(yyyymmdd.slice(4, 6));
    const d = Number(yyyymmdd.slice(6, 8));
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  const horizon = 30;
  const sample = [...activeDates].sort().slice(0, horizon);
  let weekday = 0;
  let weekend = 0;
  for (const date of sample) {
    const dow = dayOfWeek(date);
    if (dow === 0 || dow === 6) weekend += 1;
    else weekday += 1;
  }

  const total = weekday + weekend;
  if (total === 0) return undefined;

  // Tolerances: a "weekdays" pattern can include a tiny fraction of
  // weekend dates (special events) and still read as weekdays.
  if (weekend === 0 && weekday > 0) return "Arkisin";
  if (weekday === 0 && weekend > 0) return "Viikonloppuisin";
  // Full coverage: at least one date in every day-of-week bucket
  // (heuristic via `total / 7` density check on the first 7 dates).
  const firstWeek = sample.slice(0, 7).map(dayOfWeek);
  const uniqueDays = new Set(firstWeek).size;
  if (uniqueDays >= 6) return "Päivittäin";

  return "Erikoisliikenne";
}

/**
 * Derive the sparse-frequency day-type qualifier for a trip. Reads from
 * the shared `fetchAndCacheTrip` slot so a click-through to the trip
 * detail page after this call is a cache hit.
 */
export async function getServiceNoteForTrip(
  tripId: string,
  persona: Persona,
): Promise<string | undefined> {
  try {
    const { data: trip } = await fetchAndCacheTrip(tripId, persona);
    return deriveServiceNoteFromActiveDates(trip?.activeDates ?? []);
  } catch {
    return undefined;
  }
}
