/**
 * Line catalogue primitives.
 *
 * A "line" is a transit route as a brand (`shortName` is what riders see on
 * the destination sign). Each line has one or more `Pattern`s — direction-and-
 * variant stop sequences — and each pattern carries an ordered list of
 * `PatternStop`s.
 *
 * `color` is nullable because rural feeds rarely populate route colours;
 * the FE falls back to a mode-based palette in that case.
 */
export interface Line {
  gtfsId: string;
  shortName: string;
  longName: string;
  /** BUS / TRAM / RAIL / SUBWAY / FERRY / BICYCLE / FUNICULAR / etc. */
  mode: string;
  /** Hex without `#`, e.g. "00A6E2". Null when the feed has no colour. */
  color: string | null;
  /** Hex without `#`. Null when the feed has no contrast colour. */
  textColor: string | null;
  /** Operator label. Populated when the caller asks for cross-feed disambiguation. */
  agency?: { gtfsId: string; name: string };
}

export interface PatternStop {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
  code: string | null;
  platformCode: string | null;
}

export interface Pattern {
  /** Pattern code, e.g. `HSL:1059:0:01`. Stable across feed refreshes. */
  code: string;
  headsign: string;
  /** GTFS direction id — 0 or 1. */
  directionId: number;
  stops: PatternStop[];
}

/**
 * Direction id as the upstream models it — GTFS guarantees 0 or 1 for
 * line-view callers. Narrow `Pattern.directionId: number` to `DirectionId`
 * at every service boundary; tram loop patterns have been seen returning
 * 2/3, which a binary direction toggle must reject (not coerce).
 */
export type DirectionId = 0 | 1;

export type DayType = "weekday" | "saturday" | "sunday";

/**
 * Line metadata + both directional patterns. The catalogue search returns
 * `Line`; LineView reads `LineView`. The difference is that `agency` is
 * required-or-null here (the disambiguation gate guarantees it on every
 * row reaching this surface) and `region` is derived from `agency.gtfsId`
 * prefix, not the drifting agency name.
 */
export interface LineView {
  gtfsId: string;
  shortName: string;
  longName: string;
  mode: string;
  color: string | null;
  textColor: string | null;
  /**
   * Always populated when upstream surfaces an agency. The service mapper
   * coerces the optional `Line.agency?:` to `agency ?? null` explicitly
   * — don't spread `Line` straight through, the optionality is a
   * compile-time foot-gun on consumers.
   */
  agency: { gtfsId: string; name: string } | null;
  /**
   * Region label derived from `agency.gtfsId` prefix (not the agency
   * name, which drifts: "HSL" vs "Helsingin seudun liikenne
   * -kuntayhtymä"). `null` when no prefix matches.
   */
  region: string | null;
  /** Both directions when present; one-direction lines return length 1. */
  patterns: Pattern[];
}

/**
 * Per-stop next-departure enrichment on a LineView. Sourced from the
 * shared `transit:departures:v2` cache slot, filtered client-side to the
 * line's gtfsId.
 */
export interface LineStopDeparture {
  stop: PatternStop;
  /** Unix seconds. Null when no upcoming departure in the lookahead window. */
  nextDepartureUnix: number | null;
  /** Scheduled equivalent — present even when realtime is unavailable. */
  scheduledDepartureUnix: number | null;
  /** Seconds; positive = late, negative = early. */
  delaySec: number;
  realtime: boolean;
  /** Average headway in minutes over the next 60 minutes, when ≥3 departures. */
  headwayMin: number | null;
}

/**
 * One band on the frequency strip. Sentinel `headwayMin === -1` signals a
 * sparse-day collapse — the band spans the whole service day and
 * `tripTimes` carries the literal departures for FrequencyStrip to render
 * as "Vuorot tänään: …". Never do arithmetic on `headwayMin` raw; always
 * branch on `isSparseBand(band)` first.
 */
export interface FrequencyBand {
  /** "06:00" */
  fromTimeOfDay: string;
  /** "09:00" */
  toTimeOfDay: string;
  /** Minutes between departures, averaged within the band. `-1` = sparse-day sentinel. */
  headwayMin: number;
  /** Trips in the band — used for the SR-narrative density. */
  tripCount: number;
  /**
   * Literal HH:mm departures. Populated only when `headwayMin === -1`
   * (sparse-day collapse, `tripCount ≤ 4` for the whole day).
   */
  tripTimes?: string[];
}

/**
 * Guard against `headwayMin` arithmetic. The sparse sentinel keeps the
 * wire shape flat (one `FrequencyBand[]`, no discriminated union) but any
 * caller computing bar heights / sorting by frequency MUST branch on this
 * first or risk a `-1`-minute headway leaking into UI math. `0` is
 * theoretically possible from a buggy upstream; the helper must not
 * collapse it into the sparse path.
 */
export function isSparseBand(band: FrequencyBand): boolean {
  return band.headwayMin === -1;
}
