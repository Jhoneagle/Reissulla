import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Alert } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({
  alerts: [] as Alert[],
  transitRegion: "all" as string,
}));

vi.mock("../../../hooks/useAlerts", () => ({
  useLiveAlerts: () => ({
    alerts: mocks.alerts,
    status: "polling",
    sseStatus: "closed",
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/usePreferences", () => ({
  usePreferences: () => ({ data: { transitRegion: mocks.transitRegion } }),
}));

import { RegionStatusCard } from "../RegionStatusCard";

function alert(over: Partial<Alert> & { scope: Alert["scope"] }): Alert {
  return {
    id: Math.random().toString(36),
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: 0,
    endTime: null,
    headline: { fi: "", en: "" },
    description: { fi: "", en: "" },
    ...over,
  };
}

beforeEach(() => {
  mocks.alerts = [];
  mocks.transitRegion = "all";
});

describe("RegionStatusCard", () => {
  it("renders nothing when no feed alert applies", () => {
    const { container } = renderWithProviders(<RegionStatusCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("paints HSL moderated while other regions stay normal", () => {
    mocks.alerts = [alert({ scope: { kind: "route", gtfsId: "HSL:1014" } })];
    renderWithProviders(<RegionStatusCard />);
    expect(screen.getByText(/HSL: 1 disruption/i)).toBeInTheDocument();
    expect(screen.getByText(/Waltti: no disruptions/i)).toBeInTheDocument();
  });

  it("paints no-service when an alert suspends service", () => {
    mocks.alerts = [
      alert({
        scope: { kind: "route", gtfsId: "HSL:1014" },
        effect: "NO_SERVICE",
      }),
    ];
    renderWithProviders(<RegionStatusCard />);
    expect(screen.getByText(/HSL: service suspended/i)).toBeInTheDocument();
  });

  it("shows only the configured region when transitRegion is set", () => {
    mocks.transitRegion = "hsl";
    mocks.alerts = [alert({ scope: { kind: "route", gtfsId: "HSL:1014" } })];
    renderWithProviders(<RegionStatusCard />);
    expect(screen.getByText(/HSL: 1 disruption/i)).toBeInTheDocument();
    expect(screen.queryByText(/Waltti/i)).not.toBeInTheDocument();
  });
});
