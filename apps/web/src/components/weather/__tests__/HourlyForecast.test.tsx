import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { HourlyForecast as Hour } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { HourlyForecast } from "../HourlyForecast";

function buildHours(n: number, startHour = 0): Hour[] {
  return Array.from({ length: n }, (_, i) => {
    const h = (startHour + i) % 24;
    return {
      time: `2026-06-06T${h.toString().padStart(2, "0")}:00`,
      temperature: 15 + Math.sin(i / 4) * 5,
      humidity: 60,
      precipitationProbability: i % 6 === 0 ? 40 : 0,
      weatherCode: 1,
      weatherDescription: "Mainly clear",
      windSpeed: 4,
    };
  });
}

function mockMatchMedia(reduceMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduceMotion && query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("HourlyForecast", () => {
  beforeEach(() => mockMatchMedia(false));

  it("renders the graph by default and exposes a graph summary for screen readers", () => {
    renderWithProviders(
      <HourlyForecast
        hours={buildHours(48)}
        isLoading={false}
        isError={false}
      />,
    );
    expect(
      screen.getByRole("img", { name: /forecast.*temperatures/i }),
    ).toBeInTheDocument();
  });

  it("renders the accessible table when prefers-reduced-motion is set", () => {
    mockMatchMedia(true);
    renderWithProviders(
      <HourlyForecast
        hours={buildHours(48)}
        isLoading={false}
        isError={false}
      />,
    );
    expect(
      screen.getByRole("table", { name: /hourly forecast/i }),
    ).toBeInTheDocument();
  });

  it("manual toggle swaps the view", () => {
    renderWithProviders(
      <HourlyForecast
        hours={buildHours(48)}
        isLoading={false}
        isError={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show as table/i }));
    expect(
      screen.getByRole("table", { name: /hourly forecast/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show as graph/i }));
    expect(
      screen.getByRole("img", { name: /forecast.*temperatures/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing when there are no hours and not loading", () => {
    const { container } = renderWithProviders(
      <HourlyForecast hours={[]} isLoading={false} isError={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
