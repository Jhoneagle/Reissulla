import { useQuery } from "@tanstack/react-query";
import { weatherApi } from "@reissulla/api-client";

export function useCurrentWeather(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["weather-current", lat, lon],
    queryFn: () => weatherApi.getCurrent(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 15 * 60 * 1000, // matches backend cache TTL
    gcTime: 30 * 60 * 1000,
  });
}

export function useWeatherForecast(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["weather-forecast", lat, lon],
    queryFn: () => weatherApi.getForecast(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Composition snapshot — drives the dashboard primary card, the map
 * weather panel, and the map marker popup with a single round-trip.
 * staleTime tracks the tightest piece TTL (5 min for warnings) so a
 * stale-but-not-yet-revalidated render still feels current.
 */
export function useWeatherSnapshot(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["weather-snapshot", lat, lon],
    queryFn: () => weatherApi.getSnapshot(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
