import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayType, DirectionId, TransitSubStop } from "@reissulla/shared";
import {
  transitApi,
  type DeparturesOptions,
  type NearbyStopsOptions,
  type PinnedLineResponse,
  type PlanRequestInput,
  type SearchStopsOptions,
} from "@reissulla/api-client";
import { useDebounce } from "./useDebounce";

export function useStopSearch(query: string, options?: SearchStopsOptions) {
  const mode = options?.mode;
  const region = options?.region;
  const byLine = options?.byLine;
  return useQuery({
    queryKey: ["transit-stop-search", query, mode, region, byLine],
    queryFn: () => transitApi.searchStops(query, { mode, region, byLine }),
    // byLine works without a text query — keep it enabled in that case.
    enabled: Boolean(byLine) || query.length >= 2,
    staleTime: 60 * 60 * 1000, // 1 hour (stops rarely change)
  });
}

export function useNearbyStops(
  lat: number | null,
  lon: number | null,
  options?: NearbyStopsOptions,
) {
  const radius = options?.radius;
  const mode = options?.mode;
  return useQuery({
    queryKey: ["transit-nearby", lat, lon, radius, mode],
    queryFn: () => transitApi.nearbyStops(lat!, lon!, { radius, mode }),
    enabled: lat !== null && lon !== null,
    staleTime: 60 * 60 * 1000,
  });
}

export function useAdaptiveNearbyStops(
  lat: number | null,
  lon: number | null,
  mode?: string,
) {
  return useQuery({
    queryKey: ["transit-nearby-adaptive", lat, lon, mode],
    queryFn: () => transitApi.adaptiveNearbyStops(lat!, lon!, mode),
    enabled: lat !== null && lon !== null,
    staleTime: 60 * 60 * 1000,
  });
}

const PINNED_STOPS_KEY = ["transit-pinned-stops"] as const;

export function usePinnedStops(enabled = true) {
  return useQuery({
    queryKey: PINNED_STOPS_KEY,
    queryFn: () => transitApi.listPinnedStops(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePinStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transitApi.pinStop,
    onSuccess: () => qc.invalidateQueries({ queryKey: PINNED_STOPS_KEY }),
  });
}

export function useUnpinStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transitApi.unpinStop(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PINNED_STOPS_KEY }),
  });
}

const RECENT_STOPS_KEY = ["transit-recent-stops"] as const;

export function useRecentStops(enabled = true, limit?: number) {
  return useQuery({
    queryKey: [...RECENT_STOPS_KEY, limit],
    queryFn: () => transitApi.listRecentStops(limit),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useRecordRecentStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transitApi.recordRecentStop,
    onSuccess: () => qc.invalidateQueries({ queryKey: RECENT_STOPS_KEY }),
  });
}

export function useDepartures(
  subStops: TransitSubStop[],
  isStation = false,
  stationId?: string,
  options?: DeparturesOptions,
  /**
   * Override the React-Query refetch cadence. Caller-provided `false`
   * disables the auto-refetch (off mode); a number sets the interval in ms.
   * Defaults to 30 s, dropping to `false` when `options.at` is set (future
   * time queries don't need to keep re-fetching tomorrow's 17:30).
   */
  refetchIntervalOverride?: number | false,
) {
  const ids = subStops.map((s) => s.gtfsId).sort();
  const isMulti = ids.length > 1;
  // Stable key for the options bag — undefined defaults skip the segment
  // so toggling lowFloor off doesn't fight the "now" cache slot.
  const optionsKey = [
    options?.at ?? "",
    options?.mode ?? "",
    options?.lineFilter?.join(",") ?? "",
    options?.directionFilter ?? "",
    options?.lowFloorOnly ? "1" : "",
  ].join("|");
  const refetchInterval =
    refetchIntervalOverride !== undefined
      ? refetchIntervalOverride
      : options?.at
        ? false
        : 30_000;

  return useQuery({
    queryKey: ["transit-departures", ...ids, optionsKey],
    queryFn: () =>
      isMulti
        ? transitApi.multiDepartures(ids, subStops, 10, 40, stationId, options)
        : transitApi.departures(ids[0]!, 30, isStation, options),
    enabled: ids.length > 0,
    staleTime: 35 * 1000,
    gcTime: 60 * 1000,
    refetchInterval,
  });
}

export function useFirstLast(stopId: string | null, date?: string) {
  return useQuery({
    queryKey: ["transit-first-last", stopId, date],
    queryFn: () => transitApi.firstLast(stopId!, date),
    enabled: Boolean(stopId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useRoutePlan(input: PlanRequestInput | null) {
  return useQuery({
    queryKey: ["transit-plan", input],
    queryFn: () => transitApi.plan(input!),
    enabled: input !== null,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useTripDetail(tripId: string | null) {
  return useQuery({
    queryKey: ["transit-trip", tripId],
    queryFn: () => transitApi.getTripDetail(tripId!),
    enabled: Boolean(tripId),
    // Matches the server-side TRIP_DETAIL_TTL and the 30s refetch cadence
    // used by the departure board, so the live-status sentence on the trip
    // detail page stays in sync with what the user just clicked from.
    staleTime: 30 * 1000,
    refetchInterval: 30_000,
  });
}

// ── Line view ────────────────────────────────────────────────────────────

export function useLineSearch(query: string, region?: string) {
  const debounced = useDebounce(query, 300);
  return useQuery({
    queryKey: ["transit-line-search", debounced, region ?? "all"],
    queryFn: () => transitApi.searchLines(debounced, region),
    enabled: debounced.trim().length >= 1,
    // 30 min — line catalogues barely shift inside that window.
    staleTime: 30 * 60 * 1000,
  });
}

export function useLine(gtfsId: string | null) {
  return useQuery({
    queryKey: ["transit-line", gtfsId],
    queryFn: () => transitApi.getLine(gtfsId!),
    enabled: Boolean(gtfsId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useLineDepartures(
  gtfsId: string | null,
  direction?: DirectionId,
) {
  return useQuery({
    queryKey: ["transit-line-departures", gtfsId, direction ?? "any"],
    queryFn: () => transitApi.getLineDepartures(gtfsId!, direction),
    enabled: Boolean(gtfsId),
    // Mirrors LINE_DEPARTURES_TTL (60s) + the FE's 30s refetch cadence so
    // the per-stop "next departure" times feel live without hammering.
    staleTime: 60 * 1000,
    refetchInterval: 30_000,
  });
}

export function useFrequency(
  gtfsId: string | null,
  dayType: DayType,
  direction?: DirectionId,
) {
  return useQuery({
    queryKey: ["transit-line-frequency", gtfsId, dayType, direction ?? "any"],
    queryFn: () => transitApi.getFrequency(gtfsId!, dayType, direction),
    enabled: Boolean(gtfsId),
    staleTime: 30 * 60 * 1000,
  });
}

const PINNED_LINES_KEY = ["transit-pinned-lines"] as const;

export function usePinnedLines(enabled = true) {
  return useQuery({
    queryKey: PINNED_LINES_KEY,
    queryFn: () => transitApi.listPinnedLines(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePinLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transitApi.pinLine,
    // Optimistic: flip the FE icon now, invalidate to reconcile after the
    // server confirms. The mutation rolls back on error via onError.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: PINNED_LINES_KEY });
      const previous = qc.getQueryData<{ data: PinnedLineResponse[] }>(
        PINNED_LINES_KEY,
      );
      qc.setQueryData<{ data: PinnedLineResponse[] }>(
        PINNED_LINES_KEY,
        (curr) => ({
          data: [
            {
              id: `optimistic-${input.gtfsId}`,
              gtfsId: input.gtfsId,
              name: input.name,
              vehicleMode: input.vehicleMode,
              pinnedAt: new Date().toISOString(),
            },
            ...(curr?.data ?? []),
          ],
        }),
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(PINNED_LINES_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PINNED_LINES_KEY }),
  });
}

export function useUnpinLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transitApi.unpinLine(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: PINNED_LINES_KEY });
      const previous = qc.getQueryData<{ data: PinnedLineResponse[] }>(
        PINNED_LINES_KEY,
      );
      qc.setQueryData<{ data: PinnedLineResponse[] }>(
        PINNED_LINES_KEY,
        (curr) => ({
          data: (curr?.data ?? []).filter((row) => row.id !== id),
        }),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(PINNED_LINES_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PINNED_LINES_KEY }),
  });
}
