import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";

/**
 * Clear all React Query caches when the user signs out.
 *
 * Auth-gated queries (useSavedLocations, usePreferences, useRecentPlaces)
 * gate their fetch via `enabled: !!user`, but `enabled: false` only
 * stops new fetches — it does not evict the already-cached data, so
 * components that read the cache (e.g. Dashboard reading saved
 * locations) keep rendering the previous user's data until a hard
 * refresh.
 *
 * We watch for `user` transitioning from truthy → null and call
 * `queryClient.clear()` at that moment. clear() removes every cache
 * entry, which is the right hammer for sign-out: anonymous flows
 * either re-fetch from localStorage or simply don't fetch.
 */
export function useAuthCacheCleanup(): void {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    const next = user?.id ?? null;
    if (prev !== null && next === null) {
      queryClient.clear();
    }
    prevUserIdRef.current = next;
  }, [user, queryClient]);
}
