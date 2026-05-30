import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type {
  FrequencyBand,
  LineStopDeparture,
  LineView as LineViewData,
} from "@reissulla/shared";
import { ApiError } from "@reissulla/api-client";
import { renderWithProviders } from "../../../test/test-utils";
import { LineCard } from "../LineCard";

const useLineMock = vi.fn();
const useLineDeparturesMock = vi.fn();
const useFrequencyMock = vi.fn();
const usePinnedLinesMock = vi.fn();
const usePinLineMock = vi.fn();
const useUnpinLineMock = vi.fn();
const useAuthStoreMock = vi.fn();

vi.mock("../../../hooks/useTransit", () => ({
  useLine: (...a: unknown[]) => useLineMock(...a),
  useLineDepartures: (...a: unknown[]) => useLineDeparturesMock(...a),
  useFrequency: (...a: unknown[]) => useFrequencyMock(...a),
  usePinnedLines: (...a: unknown[]) => usePinnedLinesMock(...a),
  usePinLine: () => usePinLineMock(),
  useUnpinLine: () => useUnpinLineMock(),
}));

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

vi.mock("../../../stores/toast", () => ({ showToast: vi.fn() }));

function lineFixture(over: Partial<LineViewData> = {}): LineViewData {
  return {
    gtfsId: "HSL:1025",
    shortName: "25",
    longName: "Kamppi – Itäkeskus",
    mode: "BUS",
    color: null,
    textColor: null,
    agency: { gtfsId: "HSL", name: "HSL" },
    region: "HSL",
    patterns: [
      {
        code: "HSL:1025:0:01",
        headsign: "Itäkeskus",
        directionId: 0,
        stops: [
          {
            gtfsId: "s1",
            name: "Kamppi",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s2",
            name: "Hakaniemi",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s3",
            name: "Itäkeskus",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
        ],
      },
      {
        code: "HSL:1025:1:01",
        headsign: "Kamppi",
        directionId: 1,
        stops: [
          {
            gtfsId: "s3",
            name: "Itäkeskus",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s4",
            name: "Sörnäinen",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s1",
            name: "Kamppi",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
        ],
      },
    ],
    ...over,
  };
}

function band(over: Partial<FrequencyBand> = {}): FrequencyBand {
  return {
    fromTimeOfDay: "06:00",
    toTimeOfDay: "09:00",
    headwayMin: 10,
    tripCount: 18,
    ...over,
  };
}

function dep(over: Partial<LineStopDeparture> = {}): LineStopDeparture {
  return {
    stop: {
      gtfsId: "s1",
      name: "Kamppi",
      lat: 0,
      lon: 0,
      code: null,
      platformCode: null,
    },
    nextDepartureUnix: null,
    scheduledDepartureUnix: null,
    delaySec: 0,
    realtime: false,
    headwayMin: null,
    ...over,
  };
}

beforeEach(() => {
  useLineMock.mockReset();
  useLineDeparturesMock.mockReset();
  useFrequencyMock.mockReset();
  usePinnedLinesMock.mockReset().mockReturnValue({ data: { data: [] } });
  usePinLineMock
    .mockReset()
    .mockReturnValue({ mutate: vi.fn(), isPending: false });
  useUnpinLineMock
    .mockReset()
    .mockReturnValue({ mutate: vi.fn(), isPending: false });
  useAuthStoreMock.mockReset().mockReturnValue(null);
});

describe("LineCard", () => {
  it("renders the loading plate while the line query is in flight", () => {
    useLineMock.mockReturnValue({ isLoading: true, isError: false });
    useLineDeparturesMock.mockReturnValue({ data: undefined });
    useFrequencyMock.mockReturnValue({ data: undefined });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    expect(document.querySelector(".line-card--loading")).not.toBeNull();
  });

  it("renders a not-found state with no retry when 404", () => {
    const err = new ApiError("NOT_FOUND", "not found", 404);
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: err,
      refetch: vi.fn(),
    });
    useLineDeparturesMock.mockReturnValue({ data: undefined });
    useFrequencyMock.mockReturnValue({ data: undefined });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    expect(screen.getByText(/line not found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("renders masthead, direction toggle, frequency strip, and stops", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({
      data: {
        data: [dep({ nextDepartureUnix: Math.floor(Date.now() / 1000) + 300 })],
      },
    });
    useFrequencyMock.mockReturnValue({
      data: { data: [band()] },
    });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /direction/i }),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll(".freq-strip__bar").length,
    ).toBeGreaterThan(0);
  });

  it("renders an em-dash placeholder for stops with no upcoming departure", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    // Three stops, none with departure data → at least two em-dashes
    // (the third is the terminus, which renders the terminus label).
    const dashes = document.querySelectorAll(".line-card__none");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onDirectionChange when direction toggle is activated (controlled)", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    const onDirectionChange = vi.fn();
    renderWithProviders(
      <LineCard
        gtfsId="HSL:1025"
        direction={0}
        onDirectionChange={onDirectionChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /kamppi/i }));
    expect(onDirectionChange).toHaveBeenCalledWith(1);
  });

  it("flips its own dir state when uncontrolled", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    const kamppi = screen.getByRole("button", { name: /kamppi/i });
    fireEvent.click(kamppi);
    // After flip, useLineDepartures is called again with direction=1.
    const lastCall =
      useLineDeparturesMock.mock.calls[
        useLineDeparturesMock.mock.calls.length - 1
      ];
    expect(lastCall?.[1]).toBe(1);
  });

  it("renders the fineprint when showFineprint is set", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    renderWithProviders(<LineCard gtfsId="HSL:1025" showFineprint />);
    expect(document.querySelector(".line-card__fineprint")).not.toBeNull();
  });

  it("omits the fineprint by default", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    expect(document.querySelector(".line-card__fineprint")).toBeNull();
  });
});
