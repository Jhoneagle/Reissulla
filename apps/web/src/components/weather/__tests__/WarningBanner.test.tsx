import { describe, expect, it, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WeatherWarning } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { WarningBanner } from "../WarningBanner";

function makeWarning(over: Partial<WeatherWarning> = {}): WeatherWarning {
  return {
    id: "FMI:wind:1001",
    severity: "moderate",
    type: "wind",
    startTime: Date.now() - 60_000,
    endTime: Date.now() + 6 * 60 * 60 * 1000,
    region: "FI:Uusimaa",
    description: "Voimakasta tuulta Uudellamaalla",
    ...over,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("WarningBanner", () => {
  it("renders nothing when there are no warnings", () => {
    const { container } = renderWithProviders(<WarningBanner warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the upstream description verbatim when present", () => {
    renderWithProviders(<WarningBanner warnings={[makeWarning()]} />);
    expect(
      screen.getByText("Voimakasta tuulta Uudellamaalla"),
    ).toBeInTheDocument();
  });

  it("falls back to a templated sentence when description is empty", () => {
    renderWithProviders(
      <WarningBanner warnings={[makeWarning({ description: "" })]} />,
    );
    expect(screen.getByText(/in effect until/i)).toBeInTheDocument();
  });

  it("hides a warning after the user dismisses it and persists the dismissal", async () => {
    const user = userEvent.setup();
    const warning = makeWarning();
    renderWithProviders(<WarningBanner warnings={[warning]} />);

    expect(screen.getByTestId("warning-banner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss warning/i }));
    expect(screen.queryByTestId("warning-banner")).not.toBeInTheDocument();

    // Re-mount: dismissal must persist via localStorage.
    renderWithProviders(<WarningBanner warnings={[warning]} />);
    expect(screen.queryByTestId("warning-banner")).not.toBeInTheDocument();
  });

  it("uses assertive politeness for severe / extreme warnings", () => {
    renderWithProviders(
      <WarningBanner warnings={[makeWarning({ severity: "severe" })]} />,
    );
    const banner = screen.getByTestId("warning-banner");
    expect(banner.getAttribute("aria-live")).toBe("assertive");
  });

  it("uses polite politeness for minor / moderate warnings", () => {
    renderWithProviders(
      <WarningBanner warnings={[makeWarning({ severity: "moderate" })]} />,
    );
    const banner = screen.getByTestId("warning-banner");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });

  it("does not re-render a dismissed warning when endTime has not passed", () => {
    const warning = makeWarning({
      endTime: Date.now() + 5 * 60 * 60 * 1000,
    });
    const dismissed = {
      [warning.id]: { expiresAt: warning.endTime },
    };
    window.localStorage.setItem(
      "reissulla:dismissedWarnings:v1",
      JSON.stringify(dismissed),
    );

    renderWithProviders(<WarningBanner warnings={[warning]} />);
    expect(screen.queryByTestId("warning-banner")).not.toBeInTheDocument();
  });

  it("re-surfaces a dismissed warning once its endTime has passed", () => {
    const warning = makeWarning();
    const dismissed = {
      [warning.id]: { expiresAt: Date.now() - 1000 },
    };
    window.localStorage.setItem(
      "reissulla:dismissedWarnings:v1",
      JSON.stringify(dismissed),
    );

    renderWithProviders(<WarningBanner warnings={[warning]} />);
    expect(screen.getByTestId("warning-banner")).toBeInTheDocument();
  });
});
