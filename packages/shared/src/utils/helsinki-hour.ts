/**
 * Helsinki-anchored hour stamp helper.
 *
 * Open-Meteo emits hourly `time` strings as Helsinki local time without
 * a timezone designator (`"2026-05-05T12:00"`) when called with
 * `timezone: "auto"`. Comparing those strings against a UTC stamp (or
 * `Date.parse`-ing them on a non-Finland host) yields an off-by-N-hours
 * pick. This helper produces the `"YYYY-MM-DDTHH"` prefix in Helsinki
 * local time so callers can do a clean string-prefix match against
 * upstream's hourly array, regardless of where the process runs.
 *
 * The function is locale-agnostic — it uses `sv-SE` because its parts
 * format already aligns with ISO-8601 segments. The output is purely
 * mechanical; no locale text leaks through.
 */

const HELSINKI_HOUR_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * Return the `"YYYY-MM-DDTHH"` Helsinki-local hour prefix for a Unix-ms
 * timestamp. Suitable for comparing to `forecast.hourly[i].time.slice(0, 13)`.
 */
export function helsinkiHourStamp(unixMs: number): string {
  const parts = HELSINKI_HOUR_FORMATTER.formatToParts(new Date(unixMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
}
