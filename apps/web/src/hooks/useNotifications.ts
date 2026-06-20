import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@reissulla/api-client";
import { useAuthStore } from "../stores/auth";

const NOTIFICATIONS_KEY = ["notifications"] as const;
const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

/** Today's relevant alerts with unread flags. Signed-in only. */
export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => notificationsApi.list(),
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

/**
 * Unread count for the nav bell. Polls every 60 s; `refetchIntervalInBackground`
 * stays false so the poll pauses while the tab is hidden.
 */
export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    select: (res) => res.count,
    enabled: !!user,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 30 * 1000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertIds: string[]) => notificationsApi.markRead(alertIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
