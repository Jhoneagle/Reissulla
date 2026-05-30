import type { FrequencyBand } from "@reissulla/shared";

/**
 * Pure helpers for FrequencyStrip layout. Extracted so the geometry (column
 * widths, bar heights) can be unit-tested without booting jsdom + Intl.
 */

/** Minutes between HH:mm "fromTimeOfDay" and HH:mm "toTimeOfDay". */
export function minutesBetween(band: FrequencyBand): number {
  const [fh, fm] = band.fromTimeOfDay.split(":").map(Number);
  const [th, tm] = band.toTimeOfDay.split(":").map(Number);
  const from = (fh ?? 0) * 60 + (fm ?? 0);
  const to = (th ?? 0) * 60 + (tm ?? 0);
  // Wrap past midnight (e.g. 23:00 → 02:00) so bands across the day boundary
  // still get positive widths; guard with a hard minimum so columns never
  // collapse to 0 and disappear.
  const raw = to - from;
  const span = raw <= 0 ? raw + 24 * 60 : raw;
  return Math.max(span, 1);
}

/**
 * Map an average headway (minutes) to a bar height in px. Inverse so a 4-min
 * headway is visually dense and a 30-min headway looks sparse. Clamped so
 * extreme upstream values don't blow out the layout.
 */
export function barHeight(headwayMin: number): number {
  if (headwayMin <= 0) return 40;
  const MIN_PX = 40;
  const MAX_PX = 96;
  // Linear inverse mapping: 4 min → MAX_PX, 30+ min → MIN_PX.
  const clamped = Math.min(Math.max(headwayMin, 4), 30);
  const t = (30 - clamped) / (30 - 4);
  return Math.round(MIN_PX + (MAX_PX - MIN_PX) * t);
}

/**
 * Build a CSS `grid-template-columns` value where each band's column width is
 * proportional to its duration. Returned as an `fr` string ready to drop into
 * a `style.gridTemplateColumns` assignment.
 */
export function buildGridColumns(bands: FrequencyBand[]): string {
  const totals = bands.map(minutesBetween);
  const sum = totals.reduce((s, v) => s + v, 0);
  if (sum <= 0) return bands.map(() => "1fr").join(" ");
  return totals.map((v) => `${((v / sum) * 100).toFixed(2)}fr`).join(" ");
}

/** "06:00–09:00" range label using en-dash, mirroring the editorial spec. */
export function rangeLabel(band: FrequencyBand): string {
  return `${band.fromTimeOfDay}–${band.toTimeOfDay}`;
}
