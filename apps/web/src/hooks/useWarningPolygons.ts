import { useQuery } from "@tanstack/react-query";
import { weatherApi } from "@reissulla/api-client";

/**
 * Active FMI weather warnings with their bounds, for the map overlay.
 * Backend caches the underlying call to FMI for 5 minutes; the FE
 * staleTime mirrors that so we don't refetch on every focus change.
 */
export function useWarningPolygons(enabled: boolean, region: string = "") {
  return useQuery({
    queryKey: ["warning-polygons", region],
    queryFn: () => weatherApi.getWarningPolygons(region),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
