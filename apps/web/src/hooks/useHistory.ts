import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { historyApi, type HistoryListOptions } from "@reissulla/api-client";

const HISTORY_KEY = ["history-trips"] as const;
const SUGGESTED_PINS_KEY = ["history-suggested-pins"] as const;

export function useHistory(enabled = true, opts?: HistoryListOptions) {
  return useQuery({
    queryKey: [...HISTORY_KEY, opts?.limit ?? null, opts?.sinceDays ?? null],
    queryFn: () => historyApi.list(opts),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useClearHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => historyApi.clear(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: HISTORY_KEY });
      void qc.invalidateQueries({ queryKey: SUGGESTED_PINS_KEY });
    },
  });
}

export function useSuggestedPins(enabled = true) {
  return useQuery({
    queryKey: SUGGESTED_PINS_KEY,
    queryFn: () => historyApi.suggestedPins(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
