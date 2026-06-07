import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { TransitDeparture, TransitSubStop } from "@reissulla/shared";
import type { SseStatus } from "../lib/sse";
import { useLiveDepartures } from "./useLiveDepartures";

vi.mock("./useTransit", () => ({
  useDepartures: vi.fn(),
}));

vi.mock("./useFeatureFlags", () => ({
  useFeatureFlags: vi.fn(),
}));

vi.mock("../lib/sse", () => ({
  useSseSubscription: vi.fn(),
}));

const useDeparturesMock = (await import("./useTransit"))
  .useDepartures as unknown as ReturnType<typeof vi.fn>;
const useFeatureFlagsMock = (await import("./useFeatureFlags"))
  .useFeatureFlags as unknown as ReturnType<typeof vi.fn>;
const useSseSubscriptionMock = (await import("../lib/sse"))
  .useSseSubscription as unknown as ReturnType<typeof vi.fn>;

function row(overrides: Partial<TransitDeparture> = {}): TransitDeparture {
  return {
    routeShortName: "550",
    routeLongName: "Itäkeskus–Westend",
    headsign: "Westend",
    scheduledArrival: 36000,
    realtimeArrival: 36000,
    arrivalDelay: 0,
    scheduledDeparture: 36000,
    realtimeDeparture: 36000,
    departureDelay: 0,
    realtime: true,
    serviceDay: 1_730_000_000,
    vehicleMode: "BUS",
    tripId: "HSL:trip-a",
    canBoard: true,
    canAlight: true,
    ...overrides,
  };
}

function stubRest(rows: TransitDeparture[]) {
  return {
    data: {
      data: { stopName: "Itäkeskus(M)", departures: rows },
      cached: false,
    },
    isLoading: false,
    isError: false,
    dataUpdatedAt: 1_000_000,
    refetch: vi.fn(),
  };
}

function stubSse(
  data: TransitDeparture[] | null,
  status: SseStatus = data ? "open" : "connecting",
) {
  return {
    data,
    status,
    lastUpdate: data ? 2_000_000 : null,
  };
}

const subStops: TransitSubStop[] = [
  { gtfsId: "HSL:1040601", code: null, platformCode: null, vehicleMode: "BUS" },
];

beforeEach(() => {
  useDeparturesMock.mockReset();
  useFeatureFlagsMock.mockReset();
  useSseSubscriptionMock.mockReset();
});

describe("useLiveDepartures", () => {
  it("returns REST data with indicator=polling when realtimeSse flag is off", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: false } });
    useDeparturesMock.mockReturnValue(stubRest([row()]));
    useSseSubscriptionMock.mockReturnValue(stubSse(null, "closed"));

    const { result } = renderHook(() => useLiveDepartures(subStops));

    expect(result.current.indicator).toBe("polling");
    expect(result.current.source).toBe("rest-poll");
    expect(result.current.sseAttempted).toBe(false);
    expect(result.current.data?.data.departures).toHaveLength(1);
    // SSE hook should be called with null path so no EventSource is opened.
    expect(useSseSubscriptionMock).toHaveBeenCalledWith(null);
  });

  it("falls back to REST polling for stations (SSE channel is non-station)", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([row()]));
    useSseSubscriptionMock.mockReturnValue(stubSse(null, "closed"));

    const { result } = renderHook(() =>
      useLiveDepartures(subStops, true, "HSL:HKI"),
    );

    expect(result.current.sseAttempted).toBe(false);
    expect(result.current.indicator).toBe("polling");
    expect(useSseSubscriptionMock).toHaveBeenCalledWith(null);
  });

  it("falls back to REST polling for multi-stop deep-links", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([row()]));
    useSseSubscriptionMock.mockReturnValue(stubSse(null, "closed"));

    const multi: TransitSubStop[] = [
      ...subStops,
      {
        gtfsId: "HSL:1040602",
        code: null,
        platformCode: null,
        vehicleMode: "BUS",
      },
    ];
    const { result } = renderHook(() => useLiveDepartures(multi));

    expect(result.current.sseAttempted).toBe(false);
    expect(useSseSubscriptionMock).toHaveBeenCalledWith(null);
  });

  it("falls back to REST polling for future-time queries", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([row()]));
    useSseSubscriptionMock.mockReturnValue(stubSse(null, "closed"));

    const { result } = renderHook(() =>
      useLiveDepartures(subStops, false, undefined, { at: 1_730_086_400 }),
    );

    expect(result.current.sseAttempted).toBe(false);
  });

  it("attaches SSE for single-stop, non-station, no-future-time queries", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([row()]));
    useSseSubscriptionMock.mockReturnValue(stubSse(null, "connecting"));

    const { result } = renderHook(() => useLiveDepartures(subStops));

    expect(result.current.sseAttempted).toBe(true);
    expect(result.current.indicator).toBe("polling");
    expect(useSseSubscriptionMock).toHaveBeenCalledWith(
      "/api/v1/transit/stops/HSL:1040601/live",
    );
  });

  it("swaps in SSE departures and flips indicator to live once an event lands", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([row({ departureDelay: 0 })]));
    useSseSubscriptionMock.mockReturnValue(
      stubSse([row({ departureDelay: 120 })]),
    );

    const { result } = renderHook(() => useLiveDepartures(subStops));

    expect(result.current.indicator).toBe("live");
    expect(result.current.source).toBe("sse");
    expect(result.current.data?.data.departures[0]!.departureDelay).toBe(120);
    // REST envelope's stopName is preserved.
    expect(result.current.data?.data.stopName).toBe("Itäkeskus(M)");
    expect(result.current.dataUpdatedAt).toBe(2_000_000);
  });

  it("surfaces indicator=error when the SSE connection is in error state", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([row()]));
    useSseSubscriptionMock.mockReturnValue(stubSse(null, "error"));

    const { result } = renderHook(() => useLiveDepartures(subStops));

    expect(result.current.indicator).toBe("error");
    // REST data still flows underneath — the indicator surfaces the error
    // but the FE never goes data-less.
    expect(result.current.data?.data.departures).toHaveLength(1);
  });

  it("applies the user's filter chain to SSE-delivered rows", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([]));
    useSseSubscriptionMock.mockReturnValue(
      stubSse([
        row({ routeShortName: "550" }),
        row({ tripId: "HSL:trip-b", routeShortName: "551" }),
      ]),
    );

    const { result } = renderHook(() =>
      useLiveDepartures(subStops, false, undefined, { lineFilter: ["551"] }),
    );

    expect(result.current.data?.data.departures).toHaveLength(1);
    expect(result.current.data?.data.departures[0]!.routeShortName).toBe("551");
  });

  it("filters out rows the user can't board when mode=departures", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([]));
    useSseSubscriptionMock.mockReturnValue(
      stubSse([
        row({ tripId: "trip-a", canBoard: true }),
        row({ tripId: "trip-b", canBoard: false }),
      ]),
    );

    const { result } = renderHook(() => useLiveDepartures(subStops));

    expect(result.current.data?.data.departures).toHaveLength(1);
    expect(result.current.data?.data.departures[0]!.tripId).toBe("trip-a");
  });

  it("keeps mode=arrivals rows that the user can alight from", () => {
    useFeatureFlagsMock.mockReturnValue({ feature: { realtimeSse: true } });
    useDeparturesMock.mockReturnValue(stubRest([]));
    useSseSubscriptionMock.mockReturnValue(
      stubSse([
        row({ tripId: "trip-a", canAlight: true }),
        row({ tripId: "trip-b", canAlight: false }),
      ]),
    );

    const { result } = renderHook(() =>
      useLiveDepartures(subStops, false, undefined, { mode: "arrivals" }),
    );

    expect(result.current.data?.data.departures).toHaveLength(1);
    expect(result.current.data?.data.departures[0]!.tripId).toBe("trip-a");
  });
});
