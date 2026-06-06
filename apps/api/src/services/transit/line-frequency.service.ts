import {
  DEFAULT_PERSONA,
  type DayType,
  type DirectionId,
  type FrequencyBand,
  type Persona,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { LINE_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { stoptimesForDateOperation } from "../../adapters/digitransit-routing/operations/stoptimesForDate.js";
import type { AdapterContext } from "../../adapters/types.js";
import { adapterRouter } from "./adapter-router.js";
import { deriveFrequencyBands } from "./frequency-bands.js";
import { getLine } from "./lines.service.js";

function makeContext(persona: Persona): AdapterContext {
  return {
    signal: new AbortController().signal,
    locale: persona.language,
    persona,
  };
}

/**
 * Maximum number of service-date candidates to walk forward looking for a
 * non-empty schedule. 14 days covers the Finnish Christmas / Jan 1 stretch
 * where ≥4-day windows aren't enough — on a holiday week the user may see
 * the *following* week's schedule rather than "Ei liikennettä tänään"; this
 * is deliberate, the line still runs that schedule next week and the user
 * wants the shape of the day, not the calendar gap.
 */
const SERVICE_DATE_LOOKAHEAD_DAYS = 14;

/**
 * Day-of-day-type rhythm for a line — the data behind the FrequencyStrip.
 *
 * Bands are derived from `stoptimesForServiceDate` *at the first stop on
 * the chosen pattern*. Headways at through-stops downstream of a
 * short-turn or interlined branch can diverge from what the origin sees;
 * this is the first-stop bias and is acceptable for Phase 2. We render
 * the shape of the day's service, not stop-specific timing.
 *
 * Holiday-week behaviour: the service-date resolver walks forward up to
 * 14 candidate dates looking for one with ≥1 trip on the chosen pattern.
 * On Finnish holiday weeks the result can come from the *following* week
 * — document this here so a future change doesn't "fix" it into a
 * no-service path that loses the day-shape rendering.
 */
export async function getFrequency(
  gtfsId: string,
  dayType: DayType,
  directionId: DirectionId | undefined,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: FrequencyBand[]; cached: boolean }> {
  const key = cacheKey(
    "transit",
    "line-frequency",
    1,
    gtfsId,
    directionId === undefined ? "any" : String(directionId),
    dayType,
  );
  const cached = await tryCache(() => cacheGet<FrequencyBand[]>(key));
  if (cached) return { data: cached, cached: true };

  const { data: line } = await getLine(gtfsId, persona);
  const pattern =
    directionId === undefined
      ? line.patterns[0]
      : (line.patterns.find((p) => p.directionId === directionId) ??
        line.patterns[0]);
  if (!pattern || pattern.stops.length === 0) {
    await tryCache(() => cacheSet(key, [], LINE_TTL));
    return { data: [], cached: false };
  }

  const firstStopId = pattern.stops[0]!.gtfsId;
  const adapter = adapterRouter.forStopId(gtfsId);
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx = makeContext(persona);

  // Walk forward until we find a date with stoptimes on this pattern.
  let bandOffsets: number[] = [];
  for (let offset = 0; offset < SERVICE_DATE_LOOKAHEAD_DAYS; offset += 1) {
    const candidate = nextServiceDateOfType(dayType, offset);
    const patterns = await stoptimesForDateOperation(
      client,
      { stopId: firstStopId, date: candidate },
      ctx,
    );
    const match = patterns.find((p) => p.pattern.code === pattern.code);
    if (match && match.stoptimes.length > 0) {
      bandOffsets = match.stoptimes
        .map((st) => st.realtimeDeparture ?? st.scheduledDeparture)
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);
      break;
    }
  }

  const bands = deriveFrequencyBands(bandOffsets);
  await tryCache(() => cacheSet(key, bands, LINE_TTL));
  return { data: bands, cached: false };
}

/**
 * Find the YYYYMMDD of the Nth instance of the requested day-type from
 * today. `offset === 0` returns today when today already matches the
 * day-type; otherwise the next matching day. `offset === 1` returns the
 * one after that, and so on.
 */
export function nextServiceDateOfType(
  dayType: DayType,
  occurrenceIndex: number,
): string {
  const now = new Date();
  // Helsinki day-of-week. For a single-region app this is sufficient; a
  // multi-region rewrite would key off the line's adapter timezone.
  const targetDow = dayTypeToDowSet(dayType);

  // Walk forward day-by-day in UTC (we only care about the calendar date
  // label, not wall-clock precision). For each calendar date, compute its
  // Helsinki day-of-week and check against the target set.
  const seen: Date[] = [];
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  for (let i = 0; i < 90 && seen.length <= occurrenceIndex; i++) {
    const dow = helsinkiDow(cursor);
    if (targetDow.has(dow)) {
      seen.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const picked = seen[occurrenceIndex] ?? seen[seen.length - 1] ?? now;
  return formatYYYYMMDD(picked);
}

function dayTypeToDowSet(dayType: DayType): Set<number> {
  switch (dayType) {
    case "weekday":
      return new Set([1, 2, 3, 4, 5]); // Mon–Fri
    case "saturday":
      return new Set([6]);
    case "sunday":
      return new Set([0]);
  }
}

function helsinkiDow(date: Date): number {
  // Intl.DateTimeFormat doesn't expose dow directly; format weekday short
  // and map. This is locale-stable because "weekday" in the en locale
  // always returns Sun/Mon/Tue/Wed/Thu/Fri/Sat.
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Helsinki",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function formatYYYYMMDD(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date).replace(/-/g, "");
}
