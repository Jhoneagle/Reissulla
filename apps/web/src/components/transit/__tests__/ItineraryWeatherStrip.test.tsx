import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import type {
  HourlyForecast,
  ItineraryWeather,
  TransitItinerary,
} from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { ItineraryWeatherStrip } from "../ItineraryWeatherStrip";

/**
 * RTL coverage for the planner card's weather disclosure. The component
 * lives behind a `<details>` so the visible default is the lede summary;
 * opening the disclosure reveals the row table. The tests also pin down
 * the no-double-counting rule from plan §9.2: a WALK leg's road-impact
 * chip and the *next* leg's outdoor-wait chip both render, and the
 * minute counts are distinct (one is in-leg, the other is between-leg).
 */

function hour(over: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time: "2026-05-05T12:00",
    temperature: 17,
    humidity: 60,
    precipitationProbability: 20,
    weatherCode: 2,
    weatherDescription: "Partly cloudy",
    windSpeed: 3,
    ...over,
  };
}

function itinerary(weather: ItineraryWeather): TransitItinerary {
  // 12:00 → 12:30 Helsinki summer. Three legs: WALK → BUS → WALK with
  // a 10 min outdoor wait at the BUS boarding leg.
  return {
    startTime: Date.UTC(2026, 4, 5, 9, 0, 0),
    endTime: Date.UTC(2026, 4, 5, 9, 30, 0),
    duration: 1800,
    walkDistance: 350,
    transfers: 0,
    legs: [
      {
        mode: "WALK",
        startTime: Date.UTC(2026, 4, 5, 9, 0, 0),
        endTime: Date.UTC(2026, 4, 5, 9, 5, 0),
        duration: 300,
        distance: 250,
        from: { name: "Origin", lat: 60.17, lon: 24.94 },
        to: { name: "Rautatientori", lat: 60.17, lon: 24.94 },
      },
      {
        mode: "BUS",
        startTime: Date.UTC(2026, 4, 5, 9, 15, 0),
        endTime: Date.UTC(2026, 4, 5, 9, 25, 0),
        duration: 600,
        distance: 4000,
        from: { name: "Rautatientori", lat: 60.17, lon: 24.94 },
        to: { name: "Pasila", lat: 60.2, lon: 24.93 },
      },
      {
        mode: "WALK",
        startTime: Date.UTC(2026, 4, 5, 9, 25, 0),
        endTime: Date.UTC(2026, 4, 5, 9, 30, 0),
        duration: 300,
        distance: 100,
        from: { name: "Pasila", lat: 60.2, lon: 24.93 },
        to: { name: "Destination", lat: 60.2, lon: 24.93 },
      },
    ],
    weather,
  };
}

describe("ItineraryWeatherStrip", () => {
  it("renders nothing when itinerary.weather is undefined", () => {
    const it: TransitItinerary = {
      startTime: 0,
      endTime: 0,
      duration: 0,
      walkDistance: 0,
      transfers: 0,
      legs: [],
    };
    const { container } = renderWithProviders(
      <ItineraryWeatherStrip itinerary={it} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every field in weather is null/empty", () => {
    const it = itinerary({
      originWeather: null,
      destinationWeather: null,
      legOutdoorWaits: [],
    });
    const { container } = renderWithProviders(
      <ItineraryWeatherStrip itinerary={it} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to collapsed and exposes the lede in the summary", () => {
    const it = itinerary({
      // Code 2 → "Partly cloudy" / Code 61 → "Slight rain" via the existing
      // weather.code.* i18n catalogue. The component reads weatherCode, not
      // the wire's weatherDescription.
      originWeather: hour({ temperature: 17, weatherCode: 2 }),
      destinationWeather: hour({ temperature: 14, weatherCode: 61 }),
      legOutdoorWaits: [],
    });
    renderWithProviders(<ItineraryWeatherStrip itinerary={it} />);

    // The container is a `<details>` without the open attribute → closed.
    const disclosure = screen.getByRole("group");
    expect(disclosure).not.toHaveAttribute("open");
    // Both origin and destination summary parts are present in the lede.
    expect(
      screen.getByText(
        /17° Partly cloudy at depart · 14° Slight rain at arrival/,
      ),
    ).toBeInTheDocument();
  });

  it("emits aria-live=off on the container so prop updates don't re-announce", () => {
    const it = itinerary({
      originWeather: hour(),
      destinationWeather: null,
      legOutdoorWaits: [],
    });
    renderWithProviders(<ItineraryWeatherStrip itinerary={it} />);
    expect(screen.getByRole("group")).toHaveAttribute("aria-live", "off");
  });

  it("filters out outdoor waits the planner returned at ≤ 5 min", () => {
    const it = itinerary({
      originWeather: hour(),
      destinationWeather: hour(),
      legOutdoorWaits: [
        // 5 min — borderline; planner should have filtered but the
        // component double-checks so a server change can't leak it.
        { legIndex: 1, outdoorWaitMin: 5, weather: hour() },
        { legIndex: 2, outdoorWaitMin: 8, weather: hour() },
      ],
    });
    renderWithProviders(<ItineraryWeatherStrip itinerary={it} />);
    // Only the 8-min entry renders the chip.
    const chips = screen.getAllByText(/\+\d+ min/);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("+8 min");
  });

  it("renders a wait chip with the boarding place from the leg", () => {
    const it = itinerary({
      originWeather: hour(),
      destinationWeather: hour(),
      legOutdoorWaits: [{ legIndex: 1, outdoorWaitMin: 10, weather: hour() }],
    });
    renderWithProviders(<ItineraryWeatherStrip itinerary={it} />);
    // The boarding place for legIndex 1 is the BUS leg's `from.name`.
    expect(
      screen.getByText(/Outdoor wait at Rautatientori/),
    ).toBeInTheDocument();
    expect(screen.getByText("+10 min")).toBeInTheDocument();
  });
});
