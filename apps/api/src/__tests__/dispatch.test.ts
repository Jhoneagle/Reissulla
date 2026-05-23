import { describe, it, expect, vi, beforeEach } from "vitest";
import * as featureFlagService from "../services/featureFlag.service.js";
import {
  adapterForGtfsId,
  defaultAdapter,
} from "../adapters/digitransit-routing/dispatch.js";
import { AppError } from "../utils/error-envelope.js";

describe("adapter dispatch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes an HSL-prefixed gtfsId to the HSL adapter when enabled", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true },
    });

    const adapter = adapterForGtfsId("HSL:1040602");
    expect(adapter.name).toBe("digitransit-hsl");
  });

  it("falls back to Finland when HSL is disabled but the id is HSL-prefixed", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: false },
    });

    const adapter = adapterForGtfsId("HSL:1040602");
    expect(adapter.name).toBe("digitransit-finland");
  });

  it("uses Finland for unknown-prefix gtfsIds", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: true, hsl: true },
    });

    const adapter = adapterForGtfsId("VR:S_1234");
    expect(adapter.name).toBe("digitransit-finland");
  });

  it("throws 503 TRANSIT_DISABLED when every feed is disabled (id-bound)", () => {
    vi.spyOn(featureFlagService, "getFeatureFlags").mockReturnValue({
      feed: { finland: false, hsl: false },
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
      feed: { finland: false, hsl: false },
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
      feed: { finland: false, hsl: true },
    });

    const adapter = defaultAdapter();
    expect(adapter.name).toBe("digitransit-hsl");
  });
});
