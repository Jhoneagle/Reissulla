import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preferencesApi } from "@reissulla/api-client";
import type { Preferences, PreferencesPatch } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";

const QUERY_KEY = ["preferences"] as const;

export function usePreferences() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => preferencesApi.get(),
    select: (res) => res.data,
    // Only fetch for signed-in users; anonymous flows read from localStorage.
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PreferencesPatch) => preferencesApi.update(patch),
    onSuccess: (res) => {
      qc.setQueryData(QUERY_KEY, res);
    },
  });
}

export type { Preferences, PreferencesPatch };
