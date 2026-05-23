import type { CurrentWeather } from "@reissulla/shared";

export interface LedeContext {
  weather: CurrentWeather;
  sunrise?: string;
  sunset?: string;
  /** Translation lookup. Accepts a key and returns the localised string. */
  formatWeatherCode: (code: number) => string;
  /** Browser locale, e.g. "en", "fi". Used for cardinal-direction labels. */
  locale: string;
  /** "now" — defaults to new Date(); injected for testability. */
  now?: Date;
}

const DIRECTION_KEYS_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/**
 * Build a 1–3 clause editorial lede summarising the current weather.
 * Clauses:
 *   1. Always — weather description ("Mainly clear.").
 *   2. When wind data is present — "Easterly breeze." (direction + bucket).
 *   3. When within 90 minutes of sunrise or sunset — "Sun set at 21:14."
 *
 * Decorative. The underlying numerals (temperature, wind speed) still
 * render in their dedicated UI slots; this is a sentence-form summary
 * the screen reader can announce once, no double-count.
 */
export function buildWeatherLede(ctx: LedeContext): string {
  const description = sentenceCase(
    ctx.formatWeatherCode(ctx.weather.weatherCode),
  );
  const clauses: string[] = [periodise(description)];

  const wind = describeWind(ctx.weather.windSpeed, ctx.weather.windDirection);
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
  /** Translation key suffix — caller composes ("wind.still" → "Calm air."). */
  key: "still" | "breeze" | "wind" | "gale";
}

const BUCKETS: BeaufortBucket[] = [
  { maxMs: 1.5, key: "still" },
  { maxMs: 5.5, key: "breeze" },
  { maxMs: 10.5, key: "wind" },
  { maxMs: Infinity, key: "gale" },
];

function describeWind(speedMs: number, dirDeg: number): string | null {
  if (Number.isNaN(speedMs) || speedMs < 0) return null;
  const bucket = BUCKETS.find((b) => speedMs <= b.maxMs);
  if (!bucket) return null;
  if (bucket.key === "still") return "Calm air.";
  const compass = compassFromDegrees(dirDeg);
  return `${compass} ${bucket.key}.`;
}

function compassFromDegrees(deg: number): string {
  if (Number.isNaN(deg)) return "Variable";
  const normalised = ((deg % 360) + 360) % 360;
  const idx = Math.round(normalised / 45) % 8;
  const code = DIRECTION_KEYS_EN[idx]!;
  return ADJECTIVE_BY_CARDINAL[code]!;
}

const ADJECTIVE_BY_CARDINAL: Record<string, string> = {
  N: "Northerly",
  NE: "Northeasterly",
  E: "Easterly",
  SE: "Southeasterly",
  S: "Southerly",
  SW: "Southwesterly",
  W: "Westerly",
  NW: "Northwesterly",
};

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
    return delta >= 0
      ? `Sun ${event === "rise" ? "rises" : "sets"} at ${hhmm}.`
      : `Sun ${event === "rise" ? "rose" : "set"} at ${hhmm}.`;
  }
  return null;
}

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
