import { describe, it, expect, vi, beforeEach } from "vitest";
import * as featureFlagService from "../services/featureFlag.service.js";
import { adapterRouter } from "../services/transit/adapter-router.js";

function enableAll() {
  vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
    feed: { finland: true, hsl: true, waltti: true, varely: true },
  });
}

describe("adapterRouter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forStopId routes HSL ids to the HSL adapter", () => {
    enableAll();
    expect(adapterRouter.forStopId("HSL:1040602").name).toBe("digitransit-hsl");
  });

  it("forStopId routes Waltti-prefix ids to the Waltti adapter", () => {
    enableAll();
    expect(adapterRouter.forStopId("tampere:0001").name).toBe(
      "digitransit-waltti",
    );
  });

  it("forStopId routes Varely-prefix ids to the Varely adapter", () => {
    enableAll();
    expect(adapterRouter.forStopId("VARELY:42").name).toBe(
      "digitransit-varely",
    );
  });

  it("forStopId falls back to Finland for unknown prefixes", () => {
    enableAll();
    expect(adapterRouter.forStopId("VR:S_1234").name).toBe(
      "digitransit-finland",
    );
  });

  it("forCoordinate returns the Finland-wide union when enabled", () => {
    enableAll();
    expect(adapterRouter.forCoordinate(60.17, 24.94).name).toBe(
      "digitransit-finland",
    );
  });

  it("forCoordinate falls through to HSL when Finland is disabled", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: false, hsl: true, waltti: false, varely: false },
    });
    expect(adapterRouter.forCoordinate(60.17, 24.94).name).toBe(
      "digitransit-hsl",
    );
  });

  it("forSearch returns the broad-coverage adapter", () => {
    enableAll();
    expect(adapterRouter.forSearch().name).toBe("digitransit-finland");
  });

  it("all() exposes every Digitransit adapter for tooling", () => {
    const names = adapterRouter.all().map((a) => a.name);
    expect(names).toEqual([
      "digitransit-finland",
      "digitransit-hsl",
      "digitransit-waltti",
      "digitransit-varely",
    ]);
  });
});
