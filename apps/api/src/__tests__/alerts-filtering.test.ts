import { describe, expect, it } from "vitest";
import { isActiveAlert, isDisruption, type Alert } from "@reissulla/shared";

function alert(over: Partial<Alert>): Alert {
  return {
    id: "x",
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: 1_000,
    endTime: null,
    scope: { kind: "global" },
    headline: { fi: "", en: "" },
    description: { fi: "", en: "" },
    ...over,
  };
}

describe("isActiveAlert", () => {
  const now = 10_000;

  it("includes an open-ended alert already started", () => {
    expect(isActiveAlert(alert({ startTime: 5_000, endTime: null }), now)).toBe(
      true,
    );
  });

  it("excludes an alert whose window has not opened", () => {
    expect(isActiveAlert(alert({ startTime: 20_000 }), now)).toBe(false);
  });

  it("excludes an alert whose window has closed", () => {
    expect(
      isActiveAlert(alert({ startTime: 1_000, endTime: 5_000 }), now),
    ).toBe(false);
  });

  it("includes an alert within its window", () => {
    expect(
      isActiveAlert(alert({ startTime: 1_000, endTime: 20_000 }), now),
    ).toBe(true);
  });
});

describe("isDisruption", () => {
  it("treats warning and severe as disruptions", () => {
    expect(isDisruption(alert({ severity: "warning" }))).toBe(true);
    expect(isDisruption(alert({ severity: "severe" }))).toBe(true);
  });

  it("treats info as a non-disruption notice", () => {
    expect(isDisruption(alert({ severity: "info" }))).toBe(false);
  });
});
