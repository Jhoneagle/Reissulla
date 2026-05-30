/**
 * Service-day helpers for Finnish public transit.
 *
 * GTFS / Digitransit feeds attribute departures between 00:00 and ~04:00
 * local time to the *previous* calendar day's service — a "service day"
 * therefore runs roughly 04:00 → 03:59 next day. This module converts an
 * absolute unix timestamp into a service-day-aware structure and formats
 * it for display. Pure module — safe to import from both server and FE.
 */

const HELSINKI_TZ = "Europe/Helsinki";

/** Hour-of-day (local) at which a new service day starts. */
export const SERVICE_DAY_ROLLOVER_HOUR = 4;

export interface ServiceDay {
  /** Absolute unix seconds of the moment in question. */
  unix: number;
  /** YYYY-MM-DD of the service day in `tz`. */
  date: string;
  /** IANA timezone the day was computed in. */
  tz: string;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function localParts(unix: number, tz: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  for (const part of fmt.formatToParts(new Date(unix * 1000))) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
  }
  // Some locales emit "24" instead of "00" at midnight under hour12:false.
  if (hour === 24) hour = 0;
  return { year, month, day, hour, minute };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Compute the service day for an absolute unix timestamp.
 *
 * A unix timestamp whose local time-of-day falls before
 * `SERVICE_DAY_ROLLOVER_HOUR` is attributed to the *previous* calendar
 * date to match GTFS / Digitransit feed conventions.
 */
export function serviceDayFromUnix(
  unix: number,
  tz: string = HELSINKI_TZ,
): ServiceDay {
  const local = localParts(unix, tz);
  let { year, month, day } = local;

  if (local.hour < SERVICE_DAY_ROLLOVER_HOUR) {
    // Date label only — arithmetic done in UTC so DST shifts cannot move
    // the calendar day under us.
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - 1);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  }

  return {
    unix,
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    tz,
  };
}

/**
 * Format a ServiceDay's clock time for display.
 *
 * Returns `HH:mm` in the service day's timezone. Both `fi` and `en` use
 * the 24-hour Finnish convention; the locale parameter is reserved so
 * later phases can add localised prefixes ("huomenna" / "tomorrow") without
 * changing the call-site signature.
 */
export function formatDeparture(s: ServiceDay, _locale: "fi" | "en"): string {
  const local = localParts(s.unix, s.tz);
  return `${pad2(local.hour)}:${pad2(local.minute)}`;
}

/**
 * Resolve a YYYYMMDD GTFS service date plus an offset-from-midnight into
 * an absolute unix timestamp in `tz`.
 *
 * GTFS encodes stoptime offsets as "seconds since noon - 12h on the
 * service date" — a deliberate quirk so the encoding stays DST-safe
 * (noon never crosses a DST transition, so the anchor sits at a stable
 * wall clock). We compute `unix(noon-local)` for the service date and
 * subtract 12 * 3600, then add the offset.
 *
 * Cross-midnight stoptimes (offset > 86400) resolve to the next calendar
 * day naturally: a `25:30` stop on 2026-05-23 lands at 01:30 local on
 * 2026-05-24. Negative offsets (rare; predawn pre-service-day stops)
 * land before midnight on the named service date.
 */
export function unixFromServiceDate(
  yyyymmdd: string,
  offsetSeconds: number,
  tz: string = HELSINKI_TZ,
): number {
  if (yyyymmdd.length !== 8) {
    throw new TypeError(
      `unixFromServiceDate: expected "YYYYMMDD", got "${yyyymmdd}"`,
    );
  }
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new TypeError(
      `unixFromServiceDate: invalid "YYYYMMDD" date "${yyyymmdd}"`,
    );
  }
  return unixForLocalNoon(year, month, day, tz) - 12 * 3600 + offsetSeconds;
}

/**
 * Unix epoch (seconds) of 12:00 local on the given calendar date in `tz`.
 *
 * One probe-and-correct pass is sufficient because no IANA zone shifts
 * its UTC offset at noon — the offset at the probe equals the offset at
 * the corrected timestamp.
 */
function unixForLocalNoon(
  year: number,
  month: number,
  day: number,
  tz: string,
): number {
  const probeUtcSec = Math.floor(Date.UTC(year, month - 1, day, 12) / 1000);
  return probeUtcSec - tzOffsetSeconds(probeUtcSec, tz);
}

/**
 * Pick the YYYYMMDD from a trip's `activeDates` closest to the
 * service-day of `nowUnix`.
 *
 * Comparison is against the service-day label (rollover-aware) — at
 * 02:00 Helsinki the anchor stays on yesterday's GTFS date, matching
 * the convention used everywhere else in this module.
 *
 * Ties (e.g. today missing, but yesterday and tomorrow both present)
 * resolve to the **future** side: a click-through from a departure
 * board is normally aimed at the next run, not yesterday's. Returns
 * `null` for an empty list.
 */
export function nearestActiveDate(
  activeDates: string[],
  nowUnix: number,
  tz: string = HELSINKI_TZ,
): string | null {
  if (activeDates.length === 0) return null;
  const today = serviceDayFromUnix(nowUnix, tz).date.replace(/-/g, "");

  let best: string | null = null;
  let bestAbs = Number.POSITIVE_INFINITY;
  let bestDelta = 0;
  for (const candidate of activeDates) {
    const delta = daysBetween(candidate, today);
    const abs = Math.abs(delta);
    const better =
      abs < bestAbs ||
      // Same distance, current best is in the past, candidate is future
      // (or zero) — flip to the future-preferred side.
      (abs === bestAbs && bestDelta < 0 && delta >= 0);
    if (better) {
      best = candidate;
      bestAbs = abs;
      bestDelta = delta;
    }
  }
  return best;
}

function daysBetween(yyyymmdd: string, anchorYyyymmdd: string): number {
  const a = Date.UTC(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8)),
  );
  const b = Date.UTC(
    Number(anchorYyyymmdd.slice(0, 4)),
    Number(anchorYyyymmdd.slice(4, 6)) - 1,
    Number(anchorYyyymmdd.slice(6, 8)),
  );
  return Math.round((a - b) / (24 * 3600 * 1000));
}

/**
 * Seconds east of UTC for `tz` at the given moment. Positive for zones
 * ahead of UTC (Helsinki is +7200 in winter, +10800 in summer).
 */
function tzOffsetSeconds(unix: number, tz: string): number {
  const local = localParts(unix, tz);
  const localAsUtcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  // Compare both sides at minute resolution — `localParts` only carries
  // minute precision, so floor the probe to match.
  const unixMinuteFloor = Math.floor(unix / 60) * 60;
  return Math.floor(localAsUtcMs / 1000) - unixMinuteFloor;
}
