import {
  isDisruption,
  type Alert,
  type NotifiedAlert,
} from "@reissulla/shared";
import { getActive } from "../alerts/alerts.service.js";
import * as alertSeenRepo from "../../db/repositories/alert-seen.repo.js";
import * as pinnedStopsRepo from "../../db/repositories/pinned-stops.repo.js";
import * as pinnedLinesRepo from "../../db/repositories/pinned-lines.repo.js";

/**
 * Notification centre — the in-app inbox of today's alerts that matter to a
 * user. It joins the composed active-alert set (alerts.service, cached) with
 * the user's `alert_seen` receipts.
 *
 * Relevance gate (mirrors the fold-long-alert-lists principle): a directly
 * pinned stop or line shows every severity, because the user explicitly cares
 * about it; global and region-wide alerts (incl. FMI weather warnings) surface
 * only when they're service-affecting `disruptions`, so the inbox never fills
 * with low-impact network-wide info notices.
 */

function isRelevant(
  alert: Alert,
  stopIds: Set<string>,
  lineIds: Set<string>,
): boolean {
  switch (alert.scope.kind) {
    case "stop":
      return stopIds.has(alert.scope.gtfsId);
    case "route":
      return lineIds.has(alert.scope.gtfsId);
    case "region":
    case "global":
      return isDisruption(alert);
  }
}

async function relevantActiveAlerts(userId: string): Promise<Alert[]> {
  const [{ data: active }, stops, lines] = await Promise.all([
    getActive(),
    pinnedStopsRepo.listByUser(userId),
    pinnedLinesRepo.listByUser(userId),
  ]);
  const stopIds = new Set(stops.map((s) => s.gtfsId));
  const lineIds = new Set(lines.map((l) => l.gtfsId));
  return active
    .filter((alert) => isRelevant(alert, stopIds, lineIds))
    .sort((a, b) => b.startTime - a.startTime);
}

/** Today's relevant alerts with each one's unread flag for the current user. */
export async function list(userId: string): Promise<NotifiedAlert[]> {
  const [alerts, seenIds] = await Promise.all([
    relevantActiveAlerts(userId),
    alertSeenRepo.listSeenIds(userId),
  ]);
  const seen = new Set(seenIds);
  return alerts.map((alert) => ({ alert, unread: !seen.has(alert.id) }));
}

/** Mark specific alerts read. Idempotent — safe to call with already-read ids. */
export async function markRead(
  userId: string,
  alertIds: string[],
): Promise<void> {
  await alertSeenRepo.markSeen(userId, alertIds);
}

/** Mark every currently-relevant active alert read for the user. */
export async function markAllRead(userId: string): Promise<void> {
  const alerts = await relevantActiveAlerts(userId);
  await alertSeenRepo.markSeen(
    userId,
    alerts.map((a) => a.id),
  );
}

/** Count of relevant active alerts the user has not yet seen. */
export async function unreadCount(userId: string): Promise<number> {
  const notified = await list(userId);
  return notified.filter((n) => n.unread).length;
}
