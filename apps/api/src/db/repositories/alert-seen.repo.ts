import { desc, eq, notInArray } from "drizzle-orm";
import { db } from "../index.js";
import { alertSeen } from "../schema.js";

export type AlertSeenRow = typeof alertSeen.$inferSelect;

/**
 * Mark one or more alerts as seen by a user. Idempotent — the composite
 * (user_id, alert_id) primary key means re-marking an already-seen alert is a
 * no-op via `onConflictDoNothing`, so callers never have to pre-check.
 */
export async function markSeen(
  userId: string,
  alertIds: string[],
): Promise<void> {
  if (alertIds.length === 0) return;
  // Dedupe the input so a single insert can't trip the PK within one batch.
  const unique = Array.from(new Set(alertIds));
  await db
    .insert(alertSeen)
    .values(unique.map((alertId) => ({ userId, alertId })))
    .onConflictDoNothing();
}

/**
 * The set of alert ids this user has already seen. Returned as a plain array;
 * the notifications service intersects it with the in-memory active-alert set
 * to compute unread (kept in the service because that's where the active set
 * lives — the DB has no knowledge of which alerts are currently active).
 */
export async function listSeenIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ alertId: alertSeen.alertId })
    .from(alertSeen)
    .where(eq(alertSeen.userId, userId));
  return rows.map((r) => r.alertId);
}

/** Full rows for the GDPR account export, newest first. */
export async function listByUser(userId: string): Promise<AlertSeenRow[]> {
  return db
    .select()
    .from(alertSeen)
    .where(eq(alertSeen.userId, userId))
    .orderBy(desc(alertSeen.seenAt));
}

/**
 * Prune receipts whose alertId is no longer in the active set, across all
 * users — the nightly job's mechanism for keeping the table bounded. When the
 * active set is empty (no alerts in effect anywhere) every receipt is stale,
 * so the whole table is cleared. Returns the number of rows removed.
 */
export async function pruneNotIn(activeAlertIds: string[]): Promise<number> {
  const deleted =
    activeAlertIds.length === 0
      ? await db.delete(alertSeen).returning({ alertId: alertSeen.alertId })
      : await db
          .delete(alertSeen)
          .where(notInArray(alertSeen.alertId, activeAlertIds))
          .returning({ alertId: alertSeen.alertId });
  return deleted.length;
}
