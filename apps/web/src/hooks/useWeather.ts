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
