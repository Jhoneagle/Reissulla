import { useQuery } from "@tanstack/react-query";
import type { TransitSubStop } from "@reissulla/shared";
import { transitApi } from "@reissulla/api-client";

export function useStopSearch(query: string) {
  return useQuery({
    queryKey: ["transit-stop-search", query],
    queryFn: () => transitApi.searchStops(query),
    enabled: query.length >= 2,
    staleTime: 60 * 60 * 1000, // 1 hour (stops rarely change)
  });
}

export function useDepartures(
  subStops: TransitSubStop[],
  isStation = false,
  stationId?: string,
) {
  const ids = subStops.map((s) => s.gtfsId).sort();
  const isMulti = ids.length > 1;

  return useQuery({
    queryKey: ["transit-departures", ...ids],
    queryFn: () =>
      isMulti
        ? transitApi.multiDepartures(ids, subStops, 10, 40, stationId)
        : transitApi.departures(ids[0]!, 30, isStation),
    enabled: ids.length > 0,
    staleTime: 35 * 1000,
    gcTime: 60 * 1000,
    refetchInterval: 30_000,
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
      fromLat !== null &&
      fromLon !== null &&
      toLat !== null &&
      toLon !== null,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
