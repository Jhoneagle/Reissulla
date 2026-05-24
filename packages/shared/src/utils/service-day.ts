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
