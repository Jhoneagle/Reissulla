import type { CurrentWeather } from "@reissulla/shared";

export type CardinalDirection =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";
export type WindBucket = "breeze" | "wind" | "gale";

export interface LedeContext {
  weather: CurrentWeather;
  sunrise?: string;
  sunset?: string;
  /** Weather-code → localised description ("Mainly clear" / "Selkeää"). */
  formatWeatherCode: (code: number) => string;
  /**
   * Direction + bucket → localised wind clause ("Easterly breeze." /
   * "Itätuulta (heikkoa)."). Returns "Variable" + bucket when direction
   * data is unusable.
   */
  formatWind: (
    direction: CardinalDirection | "Variable",
    bucket: WindBucket,
  ) => string;
  /** Localised "Calm air." / "Tyyntä." */
  formatCalm: () => string;
  /**
   * Sun rise/set clause, with tense relative to `now`. The helper
   * decides which tense / event to use; the caller maps it to a key.
   */
  formatSun: (
    event: "rise" | "set",
    tense: "past" | "future",
    time: string,
  ) => string;
  /** "now" — defaults to new Date(); injected for testability. */
  now?: Date;
}

/**
 * Build a 1–3 clause editorial lede summarising the current weather.
 * Clauses:
 *   1. Always — weather description ("Mainly clear.").
 *   2. When wind data is present — "Easterly breeze." (direction + bucket).
 *   3. When within 90 minutes of sunrise or sunset — "Sun set at 21:14."
 *
 * All locale-bearing strings are produced by the formatters the caller
 * passes in, so the helper itself contains zero English. Decorative —
 * the underlying numerals (temperature, wind speed) still render in
 * their dedicated UI slots; this is a sentence-form summary the screen
 * reader can announce once, no double-count.
 */
export function buildWeatherLede(ctx: LedeContext): string {
  const description = sentenceCase(
    ctx.formatWeatherCode(ctx.weather.weatherCode),
  );
  const clauses: string[] = [periodise(description)];

  const wind = describeWind(ctx);
  if (wind) clauses.push(wind);

  const sun = describeSun(ctx);
  if (sun) clauses.push(sun);

  return clauses.join(" ");
}

function sentenceCase(s: string): string {
  if (s.length === 0) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

function periodise(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

interface BeaufortBucket {
  /** Inclusive max wind in m/s for this bucket. */
  maxMs: number;
  /** "still" maps to formatCalm(); the rest feed formatWind(). */
  key: "still" | WindBucket;
}

const BUCKETS: BeaufortBucket[] = [
  { maxMs: 1.5, key: "still" },
  { maxMs: 5.5, key: "breeze" },
  { maxMs: 10.5, key: "wind" },
  { maxMs: Infinity, key: "gale" },
];

const DIRECTION_KEYS: CardinalDirection[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
];

function describeWind(ctx: LedeContext): string | null {
  const speedMs = ctx.weather.windSpeed;
  const dirDeg = ctx.weather.windDirection;
  if (Number.isNaN(speedMs) || speedMs < 0) return null;
  const bucket = BUCKETS.find((b) => speedMs <= b.maxMs);
  if (!bucket) return null;
  if (bucket.key === "still") return ctx.formatCalm();
  const compass = compassFromDegrees(dirDeg);
  return ctx.formatWind(compass, bucket.key);
}

function compassFromDegrees(deg: number): CardinalDirection | "Variable" {
  if (Number.isNaN(deg)) return "Variable";
  const normalised = ((deg % 360) + 360) % 360;
  const idx = Math.round(normalised / 45) % 8;
  return DIRECTION_KEYS[idx]!;
}

const SUN_WINDOW_MS = 90 * 60 * 1000;

function describeSun(ctx: LedeContext): string | null {
  const now = ctx.now ?? new Date();
  for (const [event, iso] of [
    ["rise", ctx.sunrise],
    ["set", ctx.sunset],
  ] as const) {
    if (!iso) continue;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    const delta = t.getTime() - now.getTime();
    if (Math.abs(delta) > SUN_WINDOW_MS) continue;
    const hhmm = formatHHMM(t);
    return ctx.formatSun(event, delta >= 0 ? "future" : "past", hhmm);
  }
  return null;
}

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
