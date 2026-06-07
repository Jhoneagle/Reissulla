import { useQuery } from "@tanstack/react-query";
import { weatherApi } from "@reissulla/api-client";

/**
 * Rain / snow nowcast — separate clock from the snapshot. The backend
 * caches the computed nowcast for 60 s, so the FE matches with a 60 s
 * `refetchInterval` and a 30 s `staleTime`. The dashboard live region
 * downstream throttles announcement frequency on top of this so a fast
 * cache-miss / cache-hit flip doesn't double-announce.
 */
export function useNowcast(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["weather-nowcast", lat, lon],
    queryFn: () => weatherApi.getNowcast(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
