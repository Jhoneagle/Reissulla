import { useMemo } from "react";
import type { ApiResponse, DeparturesOptions } from "@reissulla/api-client";
import type {
  TransitDeparture,
  TransitDeparturesResult,
  TransitSubStop,
} from "@reissulla/shared";
import { useFeatureFlags } from "./useFeatureFlags";
import { useDepartures } from "./useTransit";
import {
  refreshChoiceToRestInterval,
  type RefreshChoice,
} from "./useRefreshChoice";
import { useSseSubscription, type SseStatus } from "../lib/sse";

/**
 * Source of the displayed `departures` row set. `sse` means at least one
 * live event has merged into the response; `rest-poll` means the FE is
 * relying on the existing 30 s React-Query refresh.
 */
export type LiveDeparturesSource = "sse" | "rest-poll";

/**
 * Visible state for the `<LiveIndicator>` pill. Maps the SSE connection
 * lifecycle plus the SSE-availability gate into the three FE-facing
 * states the design system distinguishes (live / polling / error).
 */
export type LiveIndicatorState = "live" | "polling" | "error";

export interface UseLiveDeparturesResult {
  data: ApiResponse<TransitDeparturesResult> | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Most recent payload landing time in wall-clock ms (SSE or REST). */
  dataUpdatedAt: number;
  refetch: () => void;
  /** Where the currently visible `departures` came from. */
  source: LiveDeparturesSource;
  /** What the `<LiveIndicator>` pill should render. */
  indicator: LiveIndicatorState;
  /** Raw SSE status, useful for diagnostic surfaces (RefreshTicker hint). */
  sseStatus: SseStatus;
  /** Whether SSE was attempted at all — `false` means "polling-only" mode. */
  sseAttempted: boolean;
}

/**
 * Apply the same filter chain the server runs in
 * `departures.service.ts:applyFilters` to a list of TransitDeparture rows.
 * Mirrored client-side so SSE-delivered unfiltered supersets can render
 * with the user's current toggles applied — without a round-trip back
 * to REST. Kept inline (and small) instead of crossing into the shared
 * package; promote if a second consumer appears.
 */
function applyFiltersClientSide(
  data: TransitDeparture[],
  options: DeparturesOptions | undefined,
): TransitDeparture[] {
  if (!options) return data.filter((d) => d.canBoard !== false);
  let out = data;
  const mode = options.mode ?? "departures";
  if (mode === "departures") out = out.filter((d) => d.canBoard !== false);
  else if (mode === "arrivals") out = out.filter((d) => d.canAlight !== false);
  if (options.lineFilter && options.lineFilter.length > 0) {
    const wanted = new Set(options.lineFilter.map((l) => l.toLowerCase()));
    out = out.filter((d) => wanted.has(d.routeShortName.toLowerCase()));
  }
  if (options.directionFilter) {
    const needle = options.directionFilter.toLowerCase();
    out = out.filter((d) => d.headsign.toLowerCase().includes(needle));
  }
  if (options.lowFloorOnly) {
    out = out.filter((d) => d.wheelchairAccessible === "POSSIBLE");
  }
  return out;
}

/**
 * Returns the live-aware departures for a stop. Combines the existing
 * 30 s REST polling (used for the initial render and as the always-on
 * fallback) with an SSE attachment to `/api/v1/transit/stops/:id/live`
 * when the server's `feature.realtimeSse` is on, the deep-link is a
 * single non-station stop, and no future-time anchor is set.
 *
 * When an SSE event has merged into the response, `source === "sse"`
 * and `indicator === "live"`. While the FE is falling back to REST
 * polling (flag off, station/multi-stop, future-time, or SSE not yet
 * connected), `source === "rest-poll"` and `indicator === "polling"`.
 * On a sustained SSE error the indicator surfaces "error" — the REST
 * polling fallback continues underneath so data never stalls.
 *
 * `byDirection` is NOT recomputed from SSE updates (cluster derivation
 * is server-side and runs on the next REST tick). For chunk 2 the live
 * payload only refreshes the flat `departures` list and the timestamps
 * the masthead surfaces.
 */
export function useLiveDepartures(
  subStops: TransitSubStop[],
  isStation = false,
  stationId?: string,
  options?: DeparturesOptions,
  /**
   * User-selected refresh cadence (DEP-14). When omitted, defaults to the
   * "live" path — SSE on, 30 s REST fallback. Other choices override the
   * REST cadence and / or gate SSE off entirely.
   */
  refreshChoice: RefreshChoice = "live",
): UseLiveDeparturesResult {
  const restInterval = refreshChoiceToRestInterval(refreshChoice);
  const rest = useDepartures(
    subStops,
    isStation,
    stationId,
    options,
    restInterval,
  );
  const flags = useFeatureFlags();

  // SSE only engages for single-stop, non-station deep-links with no
  // future-time anchor — and only when the user has chosen "live". Other
  // refresh choices opt the user out of the push stream entirely so the
  // RefreshTicker UI behaves the way users expect ("60 s" stays 60 s).
  const sseEligible =
    refreshChoice === "live" &&
    flags.feature.realtimeSse &&
    !isStation &&
    subStops.length === 1 &&
    !options?.at;
  const sseStopId = sseEligible ? subStops[0]!.gtfsId : null;
  const ssePath = sseStopId ? `/api/v1/transit/stops/${sseStopId}/live` : null;

  const sse = useSseSubscription<TransitDeparture[]>(ssePath);

  const data = useMemo<ApiResponse<TransitDeparturesResult> | undefined>(() => {
    if (!rest.data) return rest.data;
    if (!sseEligible || sse.data === null) return rest.data;
    // SSE event has landed — swap in the live departures (filtered to match
    // the user's current toggle state), keep the REST envelope's stopName,
    // frequency, byDirection, etc.
    const liveRows = applyFiltersClientSide(sse.data, options);
    return {
      ...rest.data,
      data: {
        ...rest.data.data,
        departures: liveRows,
      },
    };
  }, [rest.data, sse.data, sseEligible, options]);

  const source: LiveDeparturesSource =
    sseEligible && sse.data !== null && sse.status === "open"
      ? "sse"
      : "rest-poll";

  const indicator: LiveIndicatorState = !sseEligible
    ? "polling"
    : sse.status === "open" && sse.data !== null
      ? "live"
      : sse.status === "error"
        ? "error"
        : "polling";

  const dataUpdatedAt =
    source === "sse" && sse.lastUpdate !== null
      ? sse.lastUpdate
      : rest.dataUpdatedAt;

  return {
    data,
    isLoading: rest.isLoading,
    isError: rest.isError,
    dataUpdatedAt,
    refetch: rest.refetch,
    source,
    indicator,
    sseStatus: sse.status,
    sseAttempted: sseEligible,
  };
}
