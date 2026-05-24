import { describe, it, expect } from "vitest";
import {
  SERVICE_DAY_ROLLOVER_HOUR,
  formatDeparture,
  serviceDayFromUnix,
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
