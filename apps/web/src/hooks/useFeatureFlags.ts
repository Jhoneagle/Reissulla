import { useQuery } from "@tanstack/react-query";
import { meApi, type FeatureFlagsResponse } from "@reissulla/api-client";

const DEFAULT_FLAGS: FeatureFlagsResponse = {
  feature: { realtimeSse: false },
};

/**
 * Read the FE-facing slice of the server's feature-flag accessor. Used by
 * the realtime hook layer to decide between SSE and 30 s polling — and by
 * any future surface that needs a behaviour kill-switch. Cached for a
 * long stale time: flags flip via env vars, not per-request.
 *
 * Returns a stable default (`realtimeSse: false`) before the first fetch
 * lands so consumers can render their non-live path without waiting.
 */
export function useFeatureFlags(): FeatureFlagsResponse {
  const query = useQuery({
    queryKey: ["me-feature-flags"],
    queryFn: () => meApi.featureFlags(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  return query.data ?? DEFAULT_FLAGS;
}
