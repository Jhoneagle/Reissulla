import { pruneExpired } from "../services/history.service.js";

/**
 * Drop trip-log rows past each user's retention window. Thin wrapper around
 * the service so the cron registration and the prune-job test share one entry
 * point. Returns the total number of rows removed across all users.
 */
export async function pruneHistory(): Promise<number> {
  return pruneExpired();
}
