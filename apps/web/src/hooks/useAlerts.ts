import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { alertsApi } from "@reissulla/api-client";
import type { Alert } from "@reissulla/shared";
import { useFeatureFlags } from "./useFeatureFlags";
import { useSseSubscription, type SseStatus } from "../lib/sse";

const ALERTS_POLL_MS = 60_000;

/**
 * Which pins the caller cares about. Alerts are fetched as the full composed
 * set and filtered here at the edge (the same pattern the departures hook
 * uses), so the dashboard, a line page, and the region card all share one
 * cache entry / one SSE stream.
 */
export interface AlertScope {
  routes?: string[];
  stops?: string[];
  regions?: string[];
}

export function matchesScope(
  alert: Alert,
  scope: AlertScope | undefined,
): boolean {
  if (!scope) return true;
  const { routes, stops, regions } = scope;
  if (!routes?.length && !stops?.length && !regions?.length) return true;
  switch (alert.scope.kind) {
    case "route":
      return routes?.includes(alert.scope.gtfsId) ?? false;
    case "stop":
      return stops?.includes(alert.scope.gtfsId) ?? false;
    case "region":
      return regions?.includes(alert.scope.code) ?? false;
    case "global":
      // Network-wide notices stay relevant whatever the user pinned.
      return true;
  }
}

/** REST-only active alerts, filtered client-side by `scope`. */
export function useAlerts(scope?: AlertScope): {
  alerts: Alert[];
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.getActive(),
    staleTime: ALERTS_POLL_MS,
  });
  const all = query.data?.data ?? [];
  const scopeKey = JSON.stringify(scope ?? {});
  const alerts = useMemo(
    () => all.filter((a) => matchesScope(a, scope)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, scopeKey],
  );
  return { alerts, isLoading: query.isLoading, isError: query.isError };
}

export type AlertsLiveStatus = "live" | "polling" | "error";

export interface UseLiveAlertsResult {
  alerts: Alert[];
  /** What a status indicator should render. */
  status: AlertsLiveStatus;
  sseStatus: SseStatus;
  isLoading: boolean;
}

/**
 * Live-aware active alerts. Subscribes to `/api/v1/alerts/live` when
 * `feature.realtimeSse` is on, otherwise falls back to 60 s REST polling.
 * Either way the full composed set is fetched and filtered by `scope` at the
 * edge, so the SSE full-set stream and the polled set stay consistent.
 */
export function useLiveAlerts(scope?: AlertScope): UseLiveAlertsResult {
  const flags = useFeatureFlags();
  const sseEnabled = flags.feature.realtimeSse;

  const rest = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.getActive(),
    staleTime: ALERTS_POLL_MS,
    // Poll only when SSE can't carry updates — otherwise the stream is the
    // source of freshness and the query just seeds the first paint.
    refetchInterval: sseEnabled ? false : ALERTS_POLL_MS,
  });

  const sse = useSseSubscription<Alert[]>(
    sseEnabled ? "/api/v1/alerts/live" : null,
  );

  // Trust the stream only when it carries a well-formed alert array. A
  // malformed frame (server bug, partial deploy) must not crash the page —
  // fall back to the polled REST set, mirroring the JSON guard in
  // useSseSubscription.
  const liveSet = sseEnabled && Array.isArray(sse.data) ? sse.data : null;
  const all = liveSet ?? rest.data?.data ?? [];
  const scopeKey = JSON.stringify(scope ?? {});
  const alerts = useMemo(
    () => all.filter((a) => matchesScope(a, scope)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, scopeKey],
  );

  const status: AlertsLiveStatus = !sseEnabled
    ? "polling"
    : sse.status === "open" && liveSet !== null
      ? "live"
      : sse.status === "error"
        ? "error"
        : "polling";

  return { alerts, status, sseStatus: sse.status, isLoading: rest.isLoading };
}
