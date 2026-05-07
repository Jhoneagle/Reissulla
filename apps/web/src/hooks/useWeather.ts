import { useQuery } from "@tanstack/react-query";
import { weatherApi } from "@reissulla/api-client";

/**
 * Fetch current weather for a coordinate pair.
 * Enabled only when lat/lon are provided.
 */
export function useCurrentWeather(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["weather-current", lat, lon],
    queryFn: () => weatherApi.getCurrent(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 15 * 60 * 1000, // 15 min — matches backend cache TTL
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Fetch 7-day forecast for a coordinate pair.
 * Enabled only when lat/lon are provided.
 */
export function useWeatherForecast(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["weather-forecast", lat, lon],
    queryFn: () => weatherApi.getForecast(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
