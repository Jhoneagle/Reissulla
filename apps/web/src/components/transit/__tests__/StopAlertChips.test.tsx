import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Alert, TransitDeparture } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({ alerts: [] as Alert[] }));

vi.mock("../../../hooks/useAlerts", () => ({
  useLiveAlerts: () => ({
    alerts: mocks.alerts,
    status: "polling",
    sseStatus: "closed",
    isLoading: false,
  }),
}));

import { StopAlertChips } from "../StopAlertChips";

const departures = [
  { routeGtfsId: "HSL:1014", routeShortName: "14" },
] as TransitDeparture[];

function routeAlert(): Alert {
  return {
    id: "a1",
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: Date.now(),
    endTime: null,
    scope: { kind: "route", gtfsId: "HSL:1014" },
    headline: { fi: "Linja 14 kiertää", en: "Route 14 detour" },
    description: { fi: "Poikkeusreitti.", en: "On a detour." },
  };
}

beforeEach(() => {
  mocks.alerts = [];
});

describe("StopAlertChips", () => {
  it("renders nothing when there are no alerts", () => {
    const { container } = renderWithProviders(
      <StopAlertChips stopId="HSL:S1" departures={departures} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a chip with the route shortName and a descriptive SR label", () => {
    mocks.alerts = [routeAlert()];
    renderWithProviders(
      <StopAlertChips stopId="HSL:S1" departures={departures} />,
    );
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/service alert on route 14/i),
    ).toBeInTheDocument();
    // Full body lives in the details body.
    expect(screen.getByText("On a detour.")).toBeInTheDocument();
  });
});
