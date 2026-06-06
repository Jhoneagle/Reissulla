import { describe, expect, it } from "vitest";
import { dayTypeForToday } from "./transit-utils";

function unixAt(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

describe("dayTypeForToday", () => {
  it("returns saturday for a Saturday afternoon in Helsinki", () => {
    // 2026-05-30 is a Saturday. 15:00 local (12:00 UTC during DST).
    expect(dayTypeForToday(unixAt("2026-05-30T12:00:00Z"))).toBe("saturday");
  });

  it("returns sunday for a Sunday afternoon", () => {
    expect(dayTypeForToday(unixAt("2026-05-31T12:00:00Z"))).toBe("sunday");
  });

  it("returns weekday for a Tuesday morning", () => {
    expect(dayTypeForToday(unixAt("2026-05-26T07:00:00Z"))).toBe("weekday");
  });

  it("applies the 04:00 service-day rollover — 02:00 Sunday counts as Saturday", () => {
    // 02:00 Helsinki on Sunday = 23:00 UTC on Saturday during DST.
    expect(dayTypeForToday(unixAt("2026-05-30T23:00:00Z"))).toBe("saturday");
  });

  it("treats Monday 02:00 as Sunday (rollover boundary)", () => {
    // 02:00 Helsinki Monday = 23:00 UTC Sunday during DST.
    expect(dayTypeForToday(unixAt("2026-05-31T23:00:00Z"))).toBe("sunday");
  });
});
