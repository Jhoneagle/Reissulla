import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mapDigitransitCause,
  mapDigitransitEffect,
  mapDigitransitSeverity,
  mapWeatherWarningSeverity,
} from "../services/alerts/normalise.js";

describe("mapDigitransitSeverity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps the three known GTFS-RT levels", () => {
    expect(mapDigitransitSeverity("INFO")).toBe("info");
    expect(mapDigitransitSeverity("WARNING")).toBe("warning");
    expect(mapDigitransitSeverity("SEVERE")).toBe("severe");
  });

  it("treats unknown / missing severity as warning", () => {
    expect(mapDigitransitSeverity("UNKNOWN_SEVERITY")).toBe("warning");
    expect(mapDigitransitSeverity(null)).toBe("warning");
    expect(mapDigitransitSeverity("")).toBe("warning");
  });

  it("logs and falls back to warning for an unmapped value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(mapDigitransitSeverity("CATASTROPHIC")).toBe("warning");
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("mapDigitransitCause", () => {
  it("renames TECHNICAL_PROBLEM and passes through known causes", () => {
    expect(mapDigitransitCause("TECHNICAL_PROBLEM")).toBe("TECHNICAL");
    expect(mapDigitransitCause("ACCIDENT")).toBe("ACCIDENT");
    expect(mapDigitransitCause("MEDICAL_EMERGENCY")).toBe("MEDICAL_EMERGENCY");
  });

  it("maps unknown causes to NONE / OTHER", () => {
    expect(mapDigitransitCause("UNKNOWN_CAUSE")).toBe("NONE");
    expect(mapDigitransitCause(null)).toBe("NONE");
    expect(mapDigitransitCause("SOMETHING_NEW")).toBe("OTHER");
  });
});

describe("mapDigitransitEffect", () => {
  it("passes through service-impact effects", () => {
    expect(mapDigitransitEffect("NO_SERVICE")).toBe("NO_SERVICE");
    expect(mapDigitransitEffect("DETOUR")).toBe("DETOUR");
    expect(mapDigitransitEffect("SIGNIFICANT_DELAYS")).toBe(
      "SIGNIFICANT_DELAYS",
    );
  });

  it("folds non-modelled effects to OTHER and no-impact to null", () => {
    expect(mapDigitransitEffect("ACCESSIBILITY_ISSUE")).toBe("OTHER");
    expect(mapDigitransitEffect("OTHER_EFFECT")).toBe("OTHER");
    expect(mapDigitransitEffect("NO_EFFECT")).toBeNull();
    expect(mapDigitransitEffect(null)).toBeNull();
  });
});

describe("mapWeatherWarningSeverity", () => {
  it("collapses the four FMI levels into the three-level scale", () => {
    expect(mapWeatherWarningSeverity("minor")).toBe("info");
    expect(mapWeatherWarningSeverity("moderate")).toBe("warning");
    expect(mapWeatherWarningSeverity("severe")).toBe("severe");
    expect(mapWeatherWarningSeverity("extreme")).toBe("severe");
  });
});
