import { describe, it, expect, vi, beforeEach } from "vitest";
import * as featureFlagService from "../services/featureFlag.service.js";
import {
  HSL_PREFIXES,
  VARELY_PREFIXES,
  WALTTI_PREFIXES,
  adapterForGtfsId,
  defaultAdapter,
} from "../adapters/digitransit-routing/dispatch.js";
import { AppError } from "../utils/error-envelope.js";

function enableAll() {
  vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
    feed: { finland: true, hsl: true, waltti: true, varely: true },
  });
}

describe("adapter dispatch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes an HSL-prefixed gtfsId to the HSL adapter when enabled", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: true },
    });

    const adapter = adapterForGtfsId("HSL:1040602");
    expect(adapter.name).toBe("digitransit-hsl");
  });

  it("falls back to Finland when HSL is disabled but the id is HSL-prefixed", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: false, waltti: true, varely: true },
    });

    const adapter = adapterForGtfsId("HSL:1040602");
    expect(adapter.name).toBe("digitransit-finland");
  });

  it("uses Finland for unknown-prefix gtfsIds", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: true },
    });

    const adapter = adapterForGtfsId("VR:S_1234");
    expect(adapter.name).toBe("digitransit-finland");
  });

  it("throws 503 TRANSIT_DISABLED when every feed is disabled (id-bound)", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: false, hsl: false, waltti: false, varely: false },
    });

    expect(() => adapterForGtfsId("HSL:1040602")).toThrow(AppError);
    try {
      adapterForGtfsId("HSL:1040602");
    } catch (e) {
      const err = e as AppError;
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe("TRANSIT_DISABLED");
      expect(err.source).toBe("self");
    }
  });

  it("throws 503 TRANSIT_DISABLED when every feed is disabled (default)", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: false, hsl: false, waltti: false, varely: false },
    });

    expect(() => defaultAdapter()).toThrow(AppError);
    try {
      defaultAdapter();
    } catch (e) {
      const err = e as AppError;
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe("TRANSIT_DISABLED");
    }
  });

  it("defaultAdapter falls through to HSL when Finland is disabled but HSL is enabled", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: false, hsl: true, waltti: false, varely: false },
    });

    const adapter = defaultAdapter();
    expect(adapter.name).toBe("digitransit-hsl");
  });

  // ---- prefix-matrix coverage ----------------------------------------------

  it.each(HSL_PREFIXES)("routes prefix %s to the HSL adapter", (prefix) => {
    enableAll();
    expect(adapterForGtfsId(`${prefix}:1234`).name).toBe("digitransit-hsl");
  });

  it.each(WALTTI_PREFIXES)(
    "routes prefix %s to the Waltti adapter",
    (prefix) => {
      enableAll();
      expect(adapterForGtfsId(`${prefix}:1234`).name).toBe(
        "digitransit-waltti",
      );
    },
  );

  it.each(VARELY_PREFIXES)(
    "routes prefix %s to the Varely adapter",
    (prefix) => {
      enableAll();
      expect(adapterForGtfsId(`${prefix}:1234`).name).toBe(
        "digitransit-varely",
      );
    },
  );

  it("falls back to Finland when a Waltti prefix is disabled", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: false, varely: true },
    });
    expect(adapterForGtfsId("tampere:123").name).toBe("digitransit-finland");
  });

  it("falls back to Finland when a Varely prefix is disabled", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true, waltti: true, varely: false },
    });
    expect(adapterForGtfsId("VARELY:123").name).toBe("digitransit-finland");
  });
});
