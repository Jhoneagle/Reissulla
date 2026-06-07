import { describe, it, expect } from "vitest";
import { helsinkiHourStamp } from "@reissulla/shared";

/**
 * Unit coverage for the shared Helsinki-anchored hour-stamp helper used by
 * both the API's trip-weather composer and the dashboard's HourlyForecast
 * first-future-hour pick. The cases anchor on known wall-clock moments
 * and assert the helper produces the Helsinki-local prefix regardless of
 * the host's clock — that's the property that round-trips with
 * Open-Meteo's `timezone: "auto"` time strings.
 */

describe("helsinkiHourStamp", () => {
  it("formats a noon-UTC moment as the matching Helsinki summer-time hour", () => {
    // 2026-05-05T09:00:00Z = 12:00 Helsinki (EEST, UTC+3)
    const ms = Date.UTC(2026, 4, 5, 9, 0, 0);
    expect(helsinkiHourStamp(ms)).toBe("2026-05-05T12");
  });

  it("formats a winter-time moment with the UTC+2 offset", () => {
    // 2026-01-15T09:00:00Z = 11:00 Helsinki (EET, UTC+2)
    const ms = Date.UTC(2026, 0, 15, 9, 0, 0);
    expect(helsinkiHourStamp(ms)).toBe("2026-01-15T11");
  });

  it("rolls the date forward across midnight Helsinki", () => {
    // 2026-05-05T22:00:00Z = 01:00 next day Helsinki summer
    const ms = Date.UTC(2026, 4, 5, 22, 0, 0);
    expect(helsinkiHourStamp(ms)).toBe("2026-05-06T01");
  });

  it("zero-pads single-digit components", () => {
    // 2026-01-01T22:00:00Z = 00:00 2026-01-02 Helsinki winter
    const ms = Date.UTC(2026, 0, 1, 22, 0, 0);
    expect(helsinkiHourStamp(ms)).toBe("2026-01-02T00");
  });
});
