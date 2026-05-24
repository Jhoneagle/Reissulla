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
