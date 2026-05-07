import { useQuery } from "@tanstack/react-query";
import { transitApi } from "@reissulla/api-client";

export function useStopSearch(query: string) {
  return useQuery({
    queryKey: ["transit-stop-search", query],
    queryFn: () => transitApi.searchStops(query),
    enabled: query.length >= 2,
    staleTime: 60 * 60 * 1000, // 1 hour (stops rarely change)
  });
}

export function useDepartures(stopId: string | null, isStation = false) {
  return useQuery({
    queryKey: ["transit-departures", stopId, isStation],
    queryFn: () => transitApi.departures(stopId!, 15, isStation),
    enabled: stopId !== null,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
    refetchInterval: 30_000, // auto-refresh every 30s
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
