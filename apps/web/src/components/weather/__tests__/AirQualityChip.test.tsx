import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { AirQualitySnapshot, PollenSnapshot } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { AirQualityChip } from "../AirQualityChip";

function aq(over: Partial<AirQualitySnapshot> = {}): AirQualitySnapshot {
  return {
    europeanAqi: 25,
    pm10: 12,
    pm2_5: 8,
    nitrogenDioxide: 10,
    sulphurDioxide: 3,
    ozone: 45,
    carbonMonoxide: 0.4,
    timestamp: "2026-06-06T12:00",
    ...over,
  };
}

function pollen(over: Partial<PollenSnapshot> = {}): PollenSnapshot {
  return { timestamp: "2026-06-06T12:00", ...over };
}

describe("AirQualityChip", () => {
  it("renders nothing when no air-quality data", () => {
    const { container } = renderWithProviders(
      <AirQualityChip airQuality={null} pollen={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the AQI value and bucket label", () => {
    renderWithProviders(
      <AirQualityChip airQuality={aq({ europeanAqi: 25 })} pollen={null} />,
    );
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("Fair air")).toBeInTheDocument();
  });

  it("buckets AQI 80+ as very poor", () => {
    renderWithProviders(
      <AirQualityChip airQuality={aq({ europeanAqi: 95 })} pollen={null} />,
    );
    expect(screen.getByText("Very poor air")).toBeInTheDocument();
  });

  it("omits pollen line when all taxa are below the elevated threshold", () => {
    renderWithProviders(
      <AirQualityChip
        airQuality={aq()}
        pollen={pollen({ alder: 10, grass: 5 })}
      />,
    );
    expect(screen.queryByText(/elevated/i)).not.toBeInTheDocument();
  });

  it("collapses alder + birch into a single 'tree' label and lists grass + mugwort", () => {
    renderWithProviders(
      <AirQualityChip
        airQuality={aq()}
        pollen={pollen({ alder: 80, birch: 60, grass: 70, mugwort: 55 })}
      />,
    );
    expect(screen.getByText("Pollen elevated:")).toBeInTheDocument();
    expect(screen.getByText(/tree/)).toBeInTheDocument();
    expect(screen.getByText(/grass/)).toBeInTheDocument();
    expect(screen.getByText(/mugwort/)).toBeInTheDocument();
  });
});
