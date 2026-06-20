import { composeActiveAlerts } from "../services/alerts/alerts.service.js";
import * as alertSeenRepo from "../db/repositories/alert-seen.repo.js";

/**
 * Drop `alert_seen` receipts whose alertId is no longer reported by any
 * upstream, so the table can't grow without bound as alerts churn.
 *
 * The "still alive" check uses the full composed set (composeActiveAlerts —
 * including scheduled and recently-expired alerts the upstreams still return),
 * not the active-now slice: a receipt for an alert that's merely between its
 * effective windows is still meaningful and must survive. Returns the number
 * of rows removed.
 */
export async function pruneAlertSeen(): Promise<number> {
  const active = await composeActiveAlerts();
  const activeIds = active.map((a) => a.id);
  return alertSeenRepo.pruneNotIn(activeIds);
}
