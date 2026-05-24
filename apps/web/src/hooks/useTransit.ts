import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TransitSubStop } from "@reissulla/shared";
import {
  transitApi,
  type DeparturesOptions,
  type NearbyStopsOptions,
  type SearchStopsOptions,
} from "@reissulla/api-client";

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
  // Future-time queries stay static — no point polling tomorrow's 17:30
  // every 30 s. The refetch interval drops to 0 when `at` is set.
  const refetchInterval = options?.at ? false : 30_000;

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

export function useRoutePlan(
  fromLat: number | null,
  fromLon: number | null,
  toLat: number | null,
  toLon: number | null,
) {
  return useQuery({
    queryKey: ["transit-plan", fromLat, fromLon, toLat, toLon],
    queryFn: () => transitApi.plan(fromLat!, fromLon!, toLat!, toLon!),
    enabled:
      fromLat !== null && fromLon !== null && toLat !== null && toLon !== null,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
