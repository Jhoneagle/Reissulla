import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { locationsApi } from "@reissulla/api-client";
import type { CreateLocationInput, UpdateLocationInput } from "@reissulla/shared";
import { coordsMatch } from "../lib/geo";
import { useAuthStore } from "../stores/auth";

const QUERY_KEY = ["saved-locations"];

export function useSavedLocations() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => locationsApi.list(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveLocation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLocationInput) => locationsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateLocationInput & { id: string }) =>
      locationsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => locationsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useIsLocationSaved(lat: number, lon: number): string | null {
  const { data } = useSavedLocations();
  if (!data?.data) return null;
  const match = data.data.find((loc) =>
    coordsMatch(loc.latitude, loc.longitude, lat, lon),
  );
  return match?.id ?? null;
}
