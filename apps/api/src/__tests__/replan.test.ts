import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_PERSONA,
  type Alert,
  type AlertEffect,
  type TransitItinerary,
} from "@reissulla/shared";

/**
 * Unit coverage for the disruption-driven re-plan trigger matrix
 * (technical-plan §6.4). `planRouteFull` is mocked so these assertions are
 * about the decision logic + excludeRoutes propagation, not OTP2 output.
 */

const planRouteFull = vi.fn();
vi.mock("../services/transit/trip.service.js", () => ({
  planRouteFull: (...args: unknown[]) => planRouteFull(...args),
}));

const { suggestReplan } = await import("../services/transit/replan.service.js");

const ALT: TransitItinerary = {
  startTime: 1,
  endTime: 2,
  duration: 1,
  walkDistance: 0,
  transfers: 0,
  legs: [],
};

function itineraryOnRoute(gtfsId: string | undefined): TransitItinerary {
  return {
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_900_000,
    duration: 900,
    walkDistance: 200,
    transfers: 0,
    legs: [
      {
        mode: "WALK",
        startTime: 1_700_000_000_000,
        endTime: 1_700_000_060_000,
        duration: 60,
        distance: 100,
        from: { name: "Origin", lat: 60.17, lon: 24.94 },
        to: { name: "Stop", lat: 60.171, lon: 24.941 },
      },
      {
        mode: "BUS",
        startTime: 1_700_000_060_000,
        endTime: 1_700_000_900_000,
        duration: 840,
        distance: 5000,
        from: { name: "Stop", lat: 60.171, lon: 24.941 },
        to: { name: "Destination", lat: 60.2, lon: 24.96 },
        route: gtfsId
          ? { gtfsId, shortName: "14", longName: "Test line" }
          : { shortName: "14", longName: "Test line" },
      },
    ],
  };
}

function routeAlert(gtfsId: string, effect: AlertEffect): Alert {
  return {
    id: `alert-${gtfsId}-${effect}`,
    source: "digitransit",
    severity: "warning",
    cause: "TECHNICAL",
    effect,
    startTime: 0,
    endTime: null,
    scope: { kind: "route", gtfsId },
    headline: { fi: "", en: "" },
    description: { fi: "", en: "" },
  };
}

beforeEach(() => {
  planRouteFull.mockReset();
  planRouteFull.mockResolvedValue({
    data: { itineraries: [ALT] },
    cached: false,
  });
});

describe("suggestReplan — trigger matrix", () => {
  it("re-plans when a NO_SERVICE alert hits a route the itinerary rides", async () => {
    const result = await suggestReplan({
      baseItinerary: itineraryOnRoute("HSL:1014"),
      activeAlerts: [routeAlert("HSL:1014", "NO_SERVICE")],
      persona: DEFAULT_PERSONA,
    });
    expect(result.triggered).toBe(true);
    expect(result.reason?.effect).toContain("NO_SERVICE");
    expect(result.reason?.alertIds).toEqual(["alert-HSL:1014-NO_SERVICE"]);
    expect(result.alternative?.itineraries).toEqual([ALT]);
    expect(planRouteFull).toHaveBeenCalledWith(
      expect.objectContaining({ excludeRoutes: ["HSL:1014"] }),
    );
  });

  it("re-plans on a DETOUR alert", async () => {
    const result = await suggestReplan({
      baseItinerary: itineraryOnRoute("HSL:1014"),
      activeAlerts: [routeAlert("HSL:1014", "DETOUR")],
      persona: DEFAULT_PERSONA,
    });
    expect(result.triggered).toBe(true);
    expect(result.reason?.effect).toContain("DETOUR");
    expect(planRouteFull).toHaveBeenCalledOnce();
  });

  it("does NOT re-plan on SIGNIFICANT_DELAYS — flags alternatives instead", async () => {
    const result = await suggestReplan({
      baseItinerary: itineraryOnRoute("HSL:1014"),
      activeAlerts: [routeAlert("HSL:1014", "SIGNIFICANT_DELAYS")],
      persona: DEFAULT_PERSONA,
    });
    expect(result.triggered).toBe(false);
    expect(result.reason?.effect).toEqual(["SIGNIFICANT_DELAYS"]);
    expect(result.alternative).toBeUndefined();
    expect(planRouteFull).not.toHaveBeenCalled();
  });

  it("ignores an alert on a route the itinerary does not ride", async () => {
    const result = await suggestReplan({
      baseItinerary: itineraryOnRoute("HSL:1014"),
      activeAlerts: [routeAlert("HSL:9999", "NO_SERVICE")],
      persona: DEFAULT_PERSONA,
    });
    expect(result.triggered).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(planRouteFull).not.toHaveBeenCalled();
  });

  it("does nothing when the itinerary has no transit legs", async () => {
    const result = await suggestReplan({
      baseItinerary: itineraryOnRoute(undefined),
      activeAlerts: [routeAlert("HSL:1014", "NO_SERVICE")],
      persona: DEFAULT_PERSONA,
    });
    expect(result.triggered).toBe(false);
    expect(planRouteFull).not.toHaveBeenCalled();
  });

  it("excludes every disrupted route when several alerts hit the trip", async () => {
    const base = itineraryOnRoute("HSL:1014");
    base.legs.push({
      mode: "TRAM",
      startTime: 1_700_000_900_000,
      endTime: 1_700_001_500_000,
      duration: 600,
      distance: 3000,
      from: { name: "Destination", lat: 60.2, lon: 24.96 },
      to: { name: "Final", lat: 60.21, lon: 24.97 },
      route: { gtfsId: "HSL:1009", shortName: "9", longName: "Tram 9" },
    });
    const result = await suggestReplan({
      baseItinerary: base,
      activeAlerts: [
        routeAlert("HSL:1014", "NO_SERVICE"),
        routeAlert("HSL:1009", "DETOUR"),
      ],
      persona: DEFAULT_PERSONA,
    });
    expect(result.triggered).toBe(true);
    const call = planRouteFull.mock.calls[0]![0] as { excludeRoutes: string[] };
    expect(call.excludeRoutes.sort()).toEqual(["HSL:1009", "HSL:1014"]);
  });
});
