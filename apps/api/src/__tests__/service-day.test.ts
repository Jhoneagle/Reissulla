import { describe, it, expect } from "vitest";
import {
  SERVICE_DAY_ROLLOVER_HOUR,
  formatDeparture,
  nearestActiveDate,
  serviceDayFromUnix,
  unixFromServiceDate,
  type ServiceDay,
} from "@reissulla/shared";

// Helpers — express test timestamps as UTC seconds so the assertions are
// independent of the host machine's timezone.
function utcSeconds(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
): number {
  return Math.floor(Date.UTC(year, monthIndex, day, hour, minute, 0) / 1000);
}

describe("serviceDayFromUnix", () => {
  it("returns today's date for a daytime departure in Helsinki (EEST)", () => {
    // 2026-05-04 14:23 Europe/Helsinki = 11:23 UTC (EEST = UTC+3)
    const unix = utcSeconds(2026, 4, 4, 11, 23);
    const sd = serviceDayFromUnix(unix);
    expect(sd.date).toBe("2026-05-04");
    expect(sd.tz).toBe("Europe/Helsinki");
    expect(sd.unix).toBe(unix);
  });

  it("attributes 23:59 to today (well before rollover)", () => {
    // 2026-05-04 23:59 Europe/Helsinki = 20:59 UTC (EEST)
    const unix = utcSeconds(2026, 4, 4, 20, 59);
    expect(serviceDayFromUnix(unix).date).toBe("2026-05-04");
  });

  it("attributes 00:30 to the previous service day", () => {
    // 2026-05-05 00:30 Europe/Helsinki = 21:30 UTC May 4 (EEST)
    const unix = utcSeconds(2026, 4, 4, 21, 30);
    expect(serviceDayFromUnix(unix).date).toBe("2026-05-04");
  });

  it("attributes 03:59 to the previous service day", () => {
    // 2026-05-05 03:59 Europe/Helsinki = 00:59 UTC May 5 (EEST)
    const unix = utcSeconds(2026, 4, 5, 0, 59);
    expect(serviceDayFromUnix(unix).date).toBe("2026-05-04");
  });

  it("attributes 04:00 to the new service day (boundary)", () => {
    // 2026-05-05 04:00 Europe/Helsinki = 01:00 UTC May 5 (EEST)
    const unix = utcSeconds(2026, 4, 5, 1, 0);
    expect(serviceDayFromUnix(unix).date).toBe("2026-05-05");
  });

  it("rolls back across month boundaries", () => {
    // 2026-06-01 02:30 Europe/Helsinki = 23:30 UTC May 31 (EEST)
    const unix = utcSeconds(2026, 4, 31, 23, 30);
    expect(serviceDayFromUnix(unix).date).toBe("2026-05-31");
  });

  it("rolls back across year boundaries", () => {
    // 2026-01-01 02:30 Europe/Helsinki = 00:30 UTC Jan 1 (EET = UTC+2)
    const unix = utcSeconds(2026, 0, 1, 0, 30);
    expect(serviceDayFromUnix(unix).date).toBe("2025-12-31");
  });

  it("handles DST spring-forward — service day flips with the wall clock", () => {
    // 2026-03-29 01:00 UTC: Helsinki springs from 03:00 EET to 04:00 EEST.
    // 30 seconds before: wall clock 02:59:30 EET (Saturday's service day).
    const beforeSpring = utcSeconds(2026, 2, 29, 0, 59);
    expect(serviceDayFromUnix(beforeSpring).date).toBe("2026-03-28");
    // 1 minute after: wall clock 04:00 EEST (Sunday's service day).
    const afterSpring = utcSeconds(2026, 2, 29, 1, 0);
    expect(serviceDayFromUnix(afterSpring).date).toBe("2026-03-29");
  });

  it("handles DST fall-back — replayed 03:xx wall times stay in the prior service day", () => {
    // Helsinki fall-back: 04:00 EEST → 03:00 EET at 01:00 UTC Oct 25.
    // 02:30 EEST = 23:30 UTC Oct 24 (before the transition)
    const beforeRollback = utcSeconds(2026, 9, 24, 23, 30);
    expect(serviceDayFromUnix(beforeRollback).date).toBe("2026-10-24");
    // First 03:30 EEST = 00:30 UTC Oct 25 (still DST)
    const firstThirtyThirty = utcSeconds(2026, 9, 25, 0, 30);
    expect(serviceDayFromUnix(firstThirtyThirty).date).toBe("2026-10-24");
    // Second 03:30 EET = 01:30 UTC Oct 25 (after fall-back, replayed hour)
    const secondThirtyThirty = utcSeconds(2026, 9, 25, 1, 30);
    expect(serviceDayFromUnix(secondThirtyThirty).date).toBe("2026-10-24");
    // 04:00 EET = 02:00 UTC Oct 25 — past the rollover
    const newDay = utcSeconds(2026, 9, 25, 2, 0);
    expect(serviceDayFromUnix(newDay).date).toBe("2026-10-25");
  });

  it("respects a custom IANA timezone", () => {
    // 2026-05-04 14:23 UTC interpreted as London (BST = UTC+1): 15:23 → today.
    const unix = utcSeconds(2026, 4, 4, 14, 23);
    const sd = serviceDayFromUnix(unix, "Europe/London");
    expect(sd.date).toBe("2026-05-04");
    expect(sd.tz).toBe("Europe/London");
  });

  it("exposes the documented rollover hour as a constant", () => {
    expect(SERVICE_DAY_ROLLOVER_HOUR).toBe(4);
  });
});

describe("formatDeparture", () => {
  function asServiceDay(unix: number): ServiceDay {
    return serviceDayFromUnix(unix);
  }

  it("formats Helsinki summer afternoons as HH:mm", () => {
    const sd = asServiceDay(utcSeconds(2026, 4, 4, 11, 23));
    expect(formatDeparture(sd, "en")).toBe("14:23");
    expect(formatDeparture(sd, "fi")).toBe("14:23");
  });

  it("formats Helsinki winter mornings (EET = UTC+2)", () => {
    // 2026-01-15 09:00 Helsinki = 07:00 UTC (EET)
    const sd = asServiceDay(utcSeconds(2026, 0, 15, 7, 0));
    expect(formatDeparture(sd, "fi")).toBe("09:00");
  });

  it("pads single-digit minutes", () => {
    // 2026-05-04 14:05 Helsinki = 11:05 UTC (EEST)
    const sd = asServiceDay(utcSeconds(2026, 4, 4, 11, 5));
    expect(formatDeparture(sd, "en")).toBe("14:05");
  });

  it("renders 00:30 wall-clock even though the service day is yesterday", () => {
    const sd = asServiceDay(utcSeconds(2026, 4, 4, 21, 30));
    expect(sd.date).toBe("2026-05-04");
    expect(formatDeparture(sd, "fi")).toBe("00:30");
  });

  it("renders 23:59 at the end of a service day", () => {
    const sd = asServiceDay(utcSeconds(2026, 4, 4, 20, 59));
    expect(formatDeparture(sd, "en")).toBe("23:59");
  });

  it("renders both halves of a DST fall-back wall-clock unambiguously", () => {
    // Fall-back replays 03:00 → 04:00 wall clock. The first 03:30 is EEST
    // (00:30 UTC) and the second is EET (01:30 UTC) — same wall clock string,
    // different absolute moments.
    const first = asServiceDay(utcSeconds(2026, 9, 25, 0, 30));
    expect(formatDeparture(first, "fi")).toBe("03:30");
    const second = asServiceDay(utcSeconds(2026, 9, 25, 1, 30));
    expect(formatDeparture(second, "fi")).toBe("03:30");
    expect(first.unix).not.toBe(second.unix);
  });

  it("agrees between fi and en for the 24-hour clock", () => {
    // Sparse-frequency rural example: next departure at 06:45 next service day
    const sd = asServiceDay(utcSeconds(2026, 4, 5, 3, 45));
    expect(formatDeparture(sd, "fi")).toBe(formatDeparture(sd, "en"));
    expect(formatDeparture(sd, "fi")).toBe("06:45");
  });
});

describe("unixFromServiceDate", () => {
  // Helper: round-trip a service date + offset through the formatter so
  // tests read in wall-clock terms instead of raw unix epochs.
  function wallClock(yyyymmdd: string, offsetSeconds: number, tz?: string) {
    const unix = unixFromServiceDate(yyyymmdd, offsetSeconds, tz);
    const sd = serviceDayFromUnix(unix, tz);
    return { unix, date: sd.date, clock: formatDeparture(sd, "fi") };
  }

  it("resolves a regular EEST afternoon stop", () => {
    // 14:32 wall clock on 2026-05-23 (Helsinki, EEST)
    const result = wallClock("20260523", 14 * 3600 + 32 * 60);
    expect(result.date).toBe("2026-05-23");
    expect(result.clock).toBe("14:32");
  });

  it("resolves a midnight stop (offset 0) to 00:00 local", () => {
    // The 00:00 wall clock falls under the previous calendar day's
    // service-day label per the rollover convention.
    const result = wallClock("20260523", 0);
    expect(result.clock).toBe("00:00");
    expect(result.date).toBe("2026-05-22");
  });

  it("resolves a 23:59 stop on a regular EEST day", () => {
    const result = wallClock("20260523", 23 * 3600 + 59 * 60);
    expect(result.date).toBe("2026-05-23");
    expect(result.clock).toBe("23:59");
  });

  it("resolves a 00:30 stop attributed to today's service date", () => {
    // GTFS convention: a 00:30 wall-clock departure on Sat morning is
    // still attributed to Fri's service date with offset 24:30 (88200s).
    const result = wallClock("20260522", 24 * 3600 + 30 * 60);
    expect(result.clock).toBe("00:30");
    // serviceDayFromUnix flips 00:30 → previous calendar day per the
    // 04:00 rollover, so the labelled service day matches the input.
    expect(result.date).toBe("2026-05-22");
  });

  it("resolves a 04:00 stop attributed to yesterday's service date", () => {
    // Same convention edge: 04:00 wall on Sat morning, encoded as 28:00
    // (100800s) under Fri's service date. The serviceDayFromUnix rollover
    // bumps from "yesterday" to "today" at exactly 04:00, so the date
    // label flips here.
    const result = wallClock("20260522", 28 * 3600);
    expect(result.clock).toBe("04:00");
    expect(result.date).toBe("2026-05-23");
  });

  it("resolves a cross-midnight 25:30 stop to next-day 01:30", () => {
    const result = wallClock("20260523", 25 * 3600 + 30 * 60);
    expect(result.clock).toBe("01:30");
    // 01:30 Sat morning still sits inside Fri's service day per the
    // rollover, so the labelled date is one before the wall calendar
    // day.
    expect(result.date).toBe("2026-05-23");
  });

  it("resolves a winter EET morning stop (DST inactive)", () => {
    // 09:00 wall on 2026-01-15 (EET, UTC+2)
    const result = wallClock("20260115", 9 * 3600);
    expect(result.date).toBe("2026-01-15");
    expect(result.clock).toBe("09:00");
  });

  it("handles DST spring-forward — stops just after the gap resolve to wall clock", () => {
    // 2026-03-29 Helsinki springs forward: 03:00 EET → 04:00 EEST.
    // A 06:00 wall-clock stop on the spring-forward day should land at
    // 06:00 EEST, not 05:00 EEST (which would happen with a naive
    // midnight-based formula).
    const result = wallClock("20260329", 6 * 3600);
    expect(result.date).toBe("2026-03-29");
    expect(result.clock).toBe("06:00");
  });

  it("handles DST spring-forward — stops before the gap stay in EET", () => {
    // 02:30 EET wall on Sat morning, encoded under Fri's service day at
    // 26:30 (95400s). Saturday's 02:30 sits before the 03:00 spring.
    const result = wallClock("20260328", 26 * 3600 + 30 * 60);
    expect(result.clock).toBe("02:30");
    expect(result.date).toBe("2026-03-28");
  });

  it("handles DST fall-back — afternoon stop resolves to EET wall clock", () => {
    // 2026-10-25 falls back: 04:00 EEST → 03:00 EET at 01:00 UTC.
    // A 14:00 wall-clock stop on Sun afternoon lands in EET.
    const result = wallClock("20261025", 14 * 3600);
    expect(result.date).toBe("2026-10-25");
    expect(result.clock).toBe("14:00");
  });

  it("round-trips offset through serviceDayFromUnix for a typical departure", () => {
    // Strong invariant: any offset N for service date D, when piped
    // through unixFromServiceDate → serviceDayFromUnix → formatDeparture,
    // returns the wall clock that matches the offset modulo 24h.
    const unix = unixFromServiceDate("20260523", 15 * 3600 + 42 * 60);
    expect(formatDeparture(serviceDayFromUnix(unix), "fi")).toBe("15:42");
  });

  it("respects a custom IANA timezone (London BST)", () => {
    // 09:00 wall on 2026-05-23 in London (BST = UTC+1).
    const unix = unixFromServiceDate("20260523", 9 * 3600, "Europe/London");
    const sd = serviceDayFromUnix(unix, "Europe/London");
    expect(sd.date).toBe("2026-05-23");
    expect(formatDeparture(sd, "en")).toBe("09:00");
  });

  it("rejects a malformed date string", () => {
    expect(() => unixFromServiceDate("2026-05-23", 0)).toThrow(TypeError);
    expect(() => unixFromServiceDate("20261301", 0)).toThrow(TypeError);
    expect(() => unixFromServiceDate("20260532", 0)).toThrow(TypeError);
    expect(() => unixFromServiceDate("abcdefgh", 0)).toThrow(TypeError);
  });

  it("uses Europe/Helsinki when tz is omitted", () => {
    const explicit = unixFromServiceDate(
      "20260523",
      14 * 3600,
      "Europe/Helsinki",
    );
    const implicit = unixFromServiceDate("20260523", 14 * 3600);
    expect(implicit).toBe(explicit);
  });
});

describe("nearestActiveDate", () => {
  // 2026-05-23 14:00 Helsinki = 11:00 UTC (EEST).
  const NOW_EEST_AFTERNOON = utcSeconds(2026, 4, 23, 11, 0);
  // 2026-05-24 02:00 Helsinki = 23:00 UTC May 23 (EEST). Service-day
  // rollover still attributes this to "2026-05-23".
  const NOW_HELSINKI_0200 = utcSeconds(2026, 4, 23, 23, 0);

  it("returns null for an empty list", () => {
    expect(nearestActiveDate([], NOW_EEST_AFTERNOON)).toBeNull();
  });

  it("picks today's date when it appears in activeDates", () => {
    const dates = ["20260522", "20260523", "20260524"];
    expect(nearestActiveDate(dates, NOW_EEST_AFTERNOON)).toBe("20260523");
  });

  it("picks tomorrow when today is absent and tomorrow is present", () => {
    const dates = ["20260522", "20260524"];
    expect(nearestActiveDate(dates, NOW_EEST_AFTERNOON)).toBe("20260524");
  });

  it("picks the most recent past date when only past dates are available", () => {
    const dates = ["20260501", "20260510", "20260520"];
    expect(nearestActiveDate(dates, NOW_EEST_AFTERNOON)).toBe("20260520");
  });

  it("prefers the future side on a perfect distance tie", () => {
    // today = 20260523. yesterday and tomorrow tie at distance 1.
    const dates = ["20260522", "20260524"];
    expect(nearestActiveDate(dates, NOW_EEST_AFTERNOON)).toBe("20260524");
  });

  it("uses the service-day rollover at 02:00 Helsinki", () => {
    // At 02:00 wall clock the service-day is still yesterday's.
    // 20260523 sits exactly on "today" by service-day reckoning.
    const dates = ["20260522", "20260523", "20260524"];
    expect(nearestActiveDate(dates, NOW_HELSINKI_0200)).toBe("20260523");
  });

  it("picks the only future date when today and the past are absent", () => {
    const dates = ["20260601"];
    expect(nearestActiveDate(dates, NOW_EEST_AFTERNOON)).toBe("20260601");
  });
});
