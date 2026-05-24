import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recentPlacesApi } from "@reissulla/api-client";
import type { RecordVisitInput } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";

const QUERY_KEY = ["recent-places"] as const;

export function useRecentPlaces(limit?: number) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [...QUERY_KEY, limit ?? null],
    queryFn: () => recentPlacesApi.list(limit),
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useRecordVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordVisitInput) => recentPlacesApi.recordVisit(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteRecentPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recentPlacesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useClearRecentPlaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => recentPlacesApi.clear(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
