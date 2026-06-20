import { describe, expect, it, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alert, WeatherWarning } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { AlertBanner } from "../AlertBanner";

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

function makeAlert(over: Partial<Alert> = {}): Alert {
  return {
    id: "HSL:alert:1",
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: Date.now() - 60_000,
    endTime: Date.now() + 6 * 60 * 60 * 1000,
    scope: { kind: "route", gtfsId: "HSL:1014" },
    headline: { fi: "Linja 14 kiertää", en: "Route 14 detour" },
    description: {
      fi: "Linja 14 ajaa poikkeusreittiä.",
      en: "Route 14 is on a detour.",
    },
    ...over,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("AlertBanner kind=weather", () => {
  it("renders nothing when there are no warnings", () => {
    const { container } = renderWithProviders(
      <AlertBanner kind="weather" warnings={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the upstream description verbatim when present", () => {
    renderWithProviders(
      <AlertBanner kind="weather" warnings={[makeWarning()]} />,
    );
    expect(
      screen.getByText("Voimakasta tuulta Uudellamaalla"),
    ).toBeInTheDocument();
  });

  it("falls back to a templated sentence when description is empty", () => {
    renderWithProviders(
      <AlertBanner
        kind="weather"
        warnings={[makeWarning({ description: "" })]}
      />,
    );
    expect(screen.getByText(/in effect until/i)).toBeInTheDocument();
  });

  it("hides a warning after dismissal and persists it", async () => {
    const user = userEvent.setup();
    const warning = makeWarning();
    renderWithProviders(<AlertBanner kind="weather" warnings={[warning]} />);

    expect(screen.getByTestId("warning-banner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss warning/i }));
    expect(screen.queryByTestId("warning-banner")).not.toBeInTheDocument();

    renderWithProviders(<AlertBanner kind="weather" warnings={[warning]} />);
    expect(screen.queryByTestId("warning-banner")).not.toBeInTheDocument();
  });

  it("uses assertive politeness for severe / extreme warnings", () => {
    renderWithProviders(
      <AlertBanner
        kind="weather"
        warnings={[makeWarning({ severity: "severe" })]}
      />,
    );
    expect(screen.getByTestId("warning-banner").getAttribute("aria-live")).toBe(
      "assertive",
    );
  });

  it("uses polite politeness for minor / moderate warnings", () => {
    renderWithProviders(
      <AlertBanner
        kind="weather"
        warnings={[makeWarning({ severity: "moderate" })]}
      />,
    );
    expect(screen.getByTestId("warning-banner").getAttribute("aria-live")).toBe(
      "polite",
    );
  });
});

describe("AlertBanner kind=transit", () => {
  it("renders nothing when there are no alerts", () => {
    const { container } = renderWithProviders(
      <AlertBanner kind="transit" alerts={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the headline and body in the active locale", () => {
    renderWithProviders(<AlertBanner kind="transit" alerts={[makeAlert()]} />);
    expect(screen.getByText("Route 14 detour")).toBeInTheDocument();
    expect(screen.getByText("Route 14 is on a detour.")).toBeInTheDocument();
  });

  it("hides an alert after dismissal and persists it", async () => {
    const user = userEvent.setup();
    const alert = makeAlert();
    renderWithProviders(<AlertBanner kind="transit" alerts={[alert]} />);

    expect(screen.getByTestId("alert-banner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss alert/i }));
    expect(screen.queryByTestId("alert-banner")).not.toBeInTheDocument();

    renderWithProviders(<AlertBanner kind="transit" alerts={[alert]} />);
    expect(screen.queryByTestId("alert-banner")).not.toBeInTheDocument();
  });

  it("stays polite for a high-severity delay", () => {
    renderWithProviders(
      <AlertBanner
        kind="transit"
        alerts={[
          makeAlert({ severity: "severe", effect: "SIGNIFICANT_DELAYS" }),
        ]}
      />,
    );
    expect(screen.getByTestId("alert-banner").getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("is assertive only for a safety-of-life no-service alert", () => {
    renderWithProviders(
      <AlertBanner
        kind="transit"
        alerts={[
          makeAlert({
            severity: "severe",
            cause: "ACCIDENT",
            effect: "NO_SERVICE",
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("alert-banner").getAttribute("aria-live")).toBe(
      "assertive",
    );
  });

  it("does not create a live region when live=false", () => {
    renderWithProviders(
      <AlertBanner kind="transit" alerts={[makeAlert()]} live={false} />,
    );
    expect(screen.getByTestId("alert-banner").hasAttribute("aria-live")).toBe(
      false,
    );
  });
});
