import { describe, expect, it } from "vitest";
import type { WeatherWarning } from "@reissulla/shared";
import {
  alertContentId,
  digitransitToAlerts,
  fmiWarningsToAlerts,
} from "../services/alerts/normalise.js";
import type { RawAlert } from "../adapters/digitransit-routing/types.js";

function rawAlert(over: Partial<RawAlert> = {}): RawAlert {
  return {
    id: "feed:alert:1",
    alertHeaderTextFi: "Linja 14 peruttu",
    alertHeaderTextEn: "Route 14 cancelled",
    alertDescriptionTextFi: "Linja 14 ei liikennöi tänään.",
    alertDescriptionTextEn: "Route 14 is not running today.",
    alertCause: "TECHNICAL_PROBLEM",
    alertEffect: "NO_SERVICE",
    alertSeverityLevel: "SEVERE",
    effectiveStartDate: 1_700_000_000,
    effectiveEndDate: 1_700_003_600,
    entities: [{ __typename: "Route", gtfsId: "HSL:1014" }],
    ...over,
  };
}

describe("digitransitToAlerts", () => {
  it("normalises a single-route alert into one scoped Alert", () => {
    const [alert] = digitransitToAlerts(rawAlert());
    expect(alert).toMatchObject({
      source: "digitransit",
      severity: "severe",
      cause: "TECHNICAL",
      effect: "NO_SERVICE",
      scope: { kind: "route", gtfsId: "HSL:1014" },
      headline: { fi: "Linja 14 peruttu", en: "Route 14 cancelled" },
    });
  });

  it("converts effective dates from seconds to ms", () => {
    const [alert] = digitransitToAlerts(rawAlert());
    expect(alert!.startTime).toBe(1_700_000_000_000);
    expect(alert!.endTime).toBe(1_700_003_600_000);
  });

  it("explodes a multi-entity alert into one Alert per route and stop", () => {
    const alerts = digitransitToAlerts(
      rawAlert({
        entities: [
          { __typename: "Route", gtfsId: "HSL:1014" },
          { __typename: "Route", gtfsId: "HSL:1018" },
          { __typename: "Stop", gtfsId: "HSL:1040601" },
        ],
      }),
    );
    expect(alerts.map((a) => a.scope)).toEqual([
      { kind: "route", gtfsId: "HSL:1014" },
      { kind: "route", gtfsId: "HSL:1018" },
      { kind: "stop", gtfsId: "HSL:1040601" },
    ]);
    // Distinct scopes → distinct ids.
    expect(new Set(alerts.map((a) => a.id)).size).toBe(3);
  });

  it("falls back to a global scope when no entity is affected", () => {
    const [alert] = digitransitToAlerts(rawAlert({ entities: null }));
    expect(alert!.scope).toEqual({ kind: "global" });
  });

  it("falls back to the other language when one side is blank", () => {
    const [alert] = digitransitToAlerts(
      rawAlert({ alertDescriptionTextEn: "" }),
    );
    expect(alert!.description.en).toBe("Linja 14 ei liikennöi tänään.");
  });

  it("uses the headline as body text for header-only alerts", () => {
    const [alert] = digitransitToAlerts(
      rawAlert({ alertDescriptionTextFi: "", alertDescriptionTextEn: "" }),
    );
    expect(alert!.description.fi).toBe("Linja 14 peruttu");
  });

  it("produces a stable id across re-polls of the same alert", () => {
    const first = digitransitToAlerts(rawAlert())[0]!;
    const second = digitransitToAlerts(rawAlert())[0]!;
    expect(first.id).toBe(second.id);
  });
});

function warning(over: Partial<WeatherWarning> = {}): WeatherWarning {
  return {
    id: "FMI:wind:1001",
    severity: "moderate",
    type: "wind",
    startTime: 1_700_000_000_000,
    endTime: 1_700_010_000_000,
    region: "FI:Uusimaa",
    description: "Voimakasta tuulta",
    ...over,
  };
}

describe("fmiWarningsToAlerts", () => {
  it("zips fi + en text by warning id into a region-scoped Alert", () => {
    const alerts = fmiWarningsToAlerts(
      [warning()],
      [warning({ description: "Strong winds" })],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      source: "fmi",
      cause: "WEATHER",
      effect: null,
      severity: "warning",
      scope: { kind: "region", code: "FI:Uusimaa" },
      description: { fi: "Voimakasta tuulta", en: "Strong winds" },
    });
  });

  it("reuses fi text when the en warning is missing", () => {
    const alerts = fmiWarningsToAlerts([warning()], []);
    expect(alerts[0]!.description.en).toBe("Voimakasta tuulta");
  });
});

describe("alertContentId", () => {
  it("changes when the scope changes", () => {
    const base = {
      source: "digitransit" as const,
      startTime: 1,
      descriptionFi: "x",
    };
    const a = alertContentId({ ...base, scope: { kind: "global" } });
    const b = alertContentId({
      ...base,
      scope: { kind: "route", gtfsId: "HSL:1" },
    });
    expect(a).not.toBe(b);
  });
});
