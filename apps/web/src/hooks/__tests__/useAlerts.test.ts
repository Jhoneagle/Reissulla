import { describe, expect, it } from "vitest";
import type { Alert } from "@reissulla/shared";
import { matchesScope } from "../useAlerts";

function alert(scope: Alert["scope"]): Alert {
  return {
    id: "x",
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: 0,
    endTime: null,
    scope,
    headline: { fi: "", en: "" },
    description: { fi: "", en: "" },
  };
}

describe("matchesScope", () => {
  it("keeps everything when scope is empty or absent", () => {
    expect(
      matchesScope(alert({ kind: "route", gtfsId: "HSL:1" }), undefined),
    ).toBe(true);
    expect(matchesScope(alert({ kind: "route", gtfsId: "HSL:1" }), {})).toBe(
      true,
    );
  });

  it("matches a route scope against the pinned routes", () => {
    const a = alert({ kind: "route", gtfsId: "HSL:1014" });
    expect(matchesScope(a, { routes: ["HSL:1014"] })).toBe(true);
    expect(matchesScope(a, { routes: ["HSL:9"] })).toBe(false);
  });

  it("matches stop and region scopes independently", () => {
    expect(
      matchesScope(alert({ kind: "stop", gtfsId: "HSL:S1" }), {
        stops: ["HSL:S1"],
      }),
    ).toBe(true);
    expect(
      matchesScope(alert({ kind: "region", code: "hsl" }), {
        regions: ["hsl"],
      }),
    ).toBe(true);
    // A route-scoped alert never matches a stop-only filter.
    expect(
      matchesScope(alert({ kind: "route", gtfsId: "HSL:1014" }), {
        stops: ["HSL:S1"],
      }),
    ).toBe(false);
  });

  it("always keeps global alerts through any filter", () => {
    expect(matchesScope(alert({ kind: "global" }), { routes: ["HSL:1"] })).toBe(
      true,
    );
  });
});
