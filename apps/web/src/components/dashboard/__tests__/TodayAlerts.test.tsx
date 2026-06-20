import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alert } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({
  alerts: [] as Alert[],
}));

vi.mock("../../../hooks/useAlerts", () => ({
  useLiveAlerts: () => ({
    alerts: mocks.alerts,
    status: "polling",
    sseStatus: "closed",
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/useTransit", () => ({
  usePinnedStops: () => ({ data: { data: [] } }),
  usePinnedLines: () => ({
    data: { data: [{ gtfsId: "HSL:1014", name: "14", vehicleMode: "BUS" }] },
  }),
}));

vi.mock("../../../hooks/useSavedLocations", () => ({
  useSavedLocations: () => ({ data: { data: [] } }),
}));

import { TodayAlerts } from "../TodayAlerts";

function makeAlert(id: string): Alert {
  return {
    id,
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: Date.now(),
    endTime: null,
    scope: { kind: "route", gtfsId: "HSL:1014" },
    headline: { fi: `Tiedote ${id}`, en: `Alert ${id}` },
    description: { fi: "", en: "" },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.alerts = [];
});

describe("TodayAlerts", () => {
  it("renders nothing when there are no alerts", () => {
    const { container } = renderWithProviders(<TodayAlerts />);
    expect(container.querySelector(".today-alerts")).toBeInTheDocument();
    expect(screen.queryByTestId("alert-banner")).not.toBeInTheDocument();
  });

  it("renders the full banner list below the collapse threshold", () => {
    mocks.alerts = [makeAlert("a"), makeAlert("b")];
    renderWithProviders(<TodayAlerts />);
    expect(screen.getAllByTestId("alert-banner")).toHaveLength(2);
  });

  it("collapses to a count summary at three or more, expandable on click", async () => {
    const user = userEvent.setup();
    mocks.alerts = [makeAlert("a"), makeAlert("b"), makeAlert("c")];
    renderWithProviders(<TodayAlerts />);

    expect(screen.queryByTestId("alert-banner")).not.toBeInTheDocument();
    // Count text appears twice: the visually-hidden announce region + summary.
    expect(
      screen.getAllByText(/3 alerts affecting your pins/i).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /show alerts/i }));
    expect(screen.getAllByTestId("alert-banner")).toHaveLength(3);
  });
});
