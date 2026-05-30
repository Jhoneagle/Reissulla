import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type {
  FrequencyBand,
  LineStopDeparture,
  LineView as LineViewData,
} from "@reissulla/shared";
import { ApiError } from "@reissulla/api-client";
import { renderWithProviders } from "../../test/test-utils";
import { LineView } from "../LineView";

const useLineMock = vi.fn();
const useLineDeparturesMock = vi.fn();
const useFrequencyMock = vi.fn();
const usePinnedLinesMock = vi.fn();
const usePinLineMock = vi.fn();
const useUnpinLineMock = vi.fn();
const useAuthStoreMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("../../hooks/useTransit", () => ({
  useLine: (...a: unknown[]) => useLineMock(...a),
  useLineDepartures: (...a: unknown[]) => useLineDeparturesMock(...a),
  useFrequency: (...a: unknown[]) => useFrequencyMock(...a),
  usePinnedLines: (...a: unknown[]) => usePinnedLinesMock(...a),
  usePinLine: () => usePinLineMock(),
  useUnpinLine: () => useUnpinLineMock(),
}));

vi.mock("../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

vi.mock("../../stores/toast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

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

function band(over: Partial<FrequencyBand> = {}): FrequencyBand {
  return {
    fromTimeOfDay: "06:00",
    toTimeOfDay: "09:00",
    headwayMin: 10,
    tripCount: 18,
    ...over,
  };
}

function defaultMocks() {
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
  showToastMock.mockReset();
}

beforeEach(defaultMocks);

function render(initialEntries = ["/transit/line/HSL%3A1025"]) {
  return renderWithProviders(<LineView />, {
    initialEntries,
  });
}

describe("LineView", () => {
  it("renders the loading plate while the line query is in flight", () => {
    useLineMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });
    useLineDeparturesMock.mockReturnValue({ data: undefined });
    useFrequencyMock.mockReturnValue({ data: undefined });
    const { container } = render();
    expect(container.querySelector(".line-view--loading")).not.toBeNull();
  });

  it("renders a 404 plate (no retry) when the line is not found", () => {
    const err = new ApiError("NOT_FOUND", "not found", 404);
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: err,
      data: undefined,
      refetch: vi.fn(),
    });
    useLineDeparturesMock.mockReturnValue({ data: undefined });
    useFrequencyMock.mockReturnValue({ data: undefined });
    render();
    expect(screen.getByText(/line not found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("renders a generic error plate with retry when the request fails", () => {
    const err = new ApiError("INTERNAL", "boom", 500);
    const refetch = vi.fn();
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: err,
      data: undefined,
      refetch,
    });
    useLineDeparturesMock.mockReturnValue({ data: undefined });
    useFrequencyMock.mockReturnValue({ data: undefined });
    render();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders masthead, direction toggle, frequency strip, and stops", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({
      data: {
        data: [dep({ stop: { ...dep().stop }, nextDepartureUnix: 1735711200 })],
      },
    });
    useFrequencyMock.mockReturnValue({
      data: {
        data: [band(), band({ fromTimeOfDay: "09:00", toTimeOfDay: "15:00" })],
      },
    });
    render();
    expect(screen.getByText("25")).toBeInTheDocument();
    // Kamppi appears once in the stop list (origin) and once in the
    // direction-toggle's reverse-direction chip ("Kamppi" headsign).
    expect(screen.getAllByText("Kamppi").length).toBeGreaterThanOrEqual(1);
    const stopList = document.querySelector(".stop-list")!;
    expect(stopList.textContent).toContain("Kamppi");
    expect(stopList.textContent).toContain("Itäkeskus");
    const directionGroup = screen.getByRole("group", { name: /direction/i });
    expect(directionGroup).toBeInTheDocument();
    expect(
      document.querySelectorAll(".freq-strip__bar").length,
    ).toBeGreaterThan(0);
  });

  it("updates the URL ?dir param when the direction toggle is activated", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    render(["/transit/line/HSL%3A1025?dir=0"]);
    fireEvent.click(screen.getByRole("button", { name: /kamppi/i }));
    // direction param flipped to "1" — verified by re-querying the toggle.
    const kamppiBtn = screen.getByRole("button", { name: /kamppi/i });
    expect(kamppiBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("changes the dayType when a frequency tab is activated", () => {
    useLineMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: lineFixture() },
    });
    useLineDeparturesMock.mockReturnValue({ data: { data: [] } });
    useFrequencyMock.mockReturnValue({ data: { data: [band()] } });
    render();
    fireEvent.click(screen.getByRole("button", { name: /saturday/i }));
    // The most-recent useFrequency call should reflect the new dayType.
    const lastCall =
      useFrequencyMock.mock.calls[useFrequencyMock.mock.calls.length - 1];
    expect(lastCall?.[1]).toBe("saturday");
  });
});
