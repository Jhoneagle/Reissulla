import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { DailyForecast } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { SunWindowCard } from "../SunWindowCard";

function day(sunrise: string, sunset: string): DailyForecast {
  return {
    date: "2026-06-06",
    temperatureMax: 22,
    temperatureMin: 10,
    precipitationProbability: 0,
    weatherCode: 1,
    weatherDescription: "Mainly clear",
    sunrise,
    sunset,
  };
}

describe("SunWindowCard", () => {
  it("renders nothing without daily data", () => {
    const { container } = renderWithProviders(
      <SunWindowCard daily={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows sunrise + sunset clock times from the upstream-local ISO strings", () => {
    renderWithProviders(
      <SunWindowCard daily={[day("2026-06-06T04:12", "2026-06-06T22:48")]} />,
    );
    expect(screen.getByText("04:12")).toBeInTheDocument();
    expect(screen.getByText("22:48")).toBeInTheDocument();
  });

  it("computes the daylight duration in hours and minutes", () => {
    renderWithProviders(
      <SunWindowCard daily={[day("2026-06-06T04:12", "2026-06-06T22:48")]} />,
    );
    // 22:48 − 04:12 = 18h 36m
    expect(screen.getByText(/18h 36m of daylight/)).toBeInTheDocument();
  });
});
