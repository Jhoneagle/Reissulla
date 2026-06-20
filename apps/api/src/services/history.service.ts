import {
  DEFAULT_HISTORY_RETENTION_DAYS,
  type PinSuggestion,
  type PinSuggestions,
  type TransitItinerary,
  type TripLogEntry,
} from "@reissulla/shared";
import * as tripLogRepo from "../db/repositories/trip-log.repo.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";
import * as pinnedStopsRepo from "../db/repositories/pinned-stops.repo.js";
import * as pinnedLinesRepo from "../db/repositories/pinned-lines.repo.js";

/** HIST-2 suggestion tuning. */
const SUGGEST_WINDOW_DAYS = 30;
const SUGGEST_MIN_USES = 3;
const SUGGEST_MAX = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LogTripInput {
  userId: string;
  from: { lat: number; lon: number; name?: string | null };
  to: { lat: number; lon: number; name?: string | null };
  itinerary: TransitItinerary;
}

/**
 * Record a planned itinerary — but only when the user has opted in. Reads the
 * `tripLogEnabled` flag itself so the planner can fire-and-forget without
 * first loading preferences. Opted-out users are silently skipped; anonymous
 * callers never reach here (the route only calls this with a resolved userId),
 * which is how share-link reads stay out of the log.
 */
export async function logIfEnabled(input: LogTripInput): Promise<void> {
  const prefs = await preferencesRepo.findByUserId(input.userId);
  if (!prefs?.tripLogEnabled) return;
  await tripLogRepo.insert({
    userId: input.userId,
    fromLat: input.from.lat,
    fromLon: input.from.lon,
    toLat: input.to.lat,
    toLon: input.to.lon,
    fromName: input.from.name ?? null,
    toName: input.to.name ?? null,
    itinerary: input.itinerary,
  });
}

export async function list(
  userId: string,
  opts: { limit?: number; sinceDays?: number } = {},
): Promise<TripLogEntry[]> {
  const rows = await tripLogRepo.listByUser(userId, opts);
  return rows.map(toEntry);
}

export async function clear(userId: string): Promise<number> {
  return tripLogRepo.clearByUser(userId);
}

/**
 * HIST-2 — frequently-used stops and lines the user hasn't pinned yet, derived
 * statelessly from the trip log over the last 30 days. Aggregation runs in JS
 * over the windowed rows rather than in SQL: the frequency signal lives inside
 * the itinerary jsonb (leg route ids + boarding-stop ids), and at hobby scale
 * the row count is tiny, so a jsonb aggregation query would be more fragile
 * than it's worth. A stop/line that appears >= 3 times and isn't already
 * pinned becomes a suggestion; the top 3 by use-count are returned.
 */
export async function suggestPins(userId: string): Promise<PinSuggestions> {
  const [rows, pinnedStops, pinnedLines] = await Promise.all([
    tripLogRepo.listByUser(userId, { sinceDays: SUGGEST_WINDOW_DAYS }),
    pinnedStopsRepo.listByUser(userId),
    pinnedLinesRepo.listByUser(userId),
  ]);

  const pinnedStopIds = new Set(pinnedStops.map((s) => s.gtfsId));
  const pinnedLineIds = new Set(pinnedLines.map((l) => l.gtfsId));

  type Tally = { name: string; vehicleMode: string | null; uses: number };
  const stopCounts = new Map<string, Tally>();
  const lineCounts = new Map<string, Tally>();

  const bump = (
    map: Map<string, Tally>,
    id: string,
    name: string,
    vehicleMode: string | null,
  ) => {
    const existing = map.get(id);
    if (existing) existing.uses += 1;
    else map.set(id, { name, vehicleMode, uses: 1 });
  };

  for (const row of rows) {
    const itinerary = row.itinerary as TransitItinerary | null;
    if (!itinerary || !Array.isArray(itinerary.legs)) continue;
    for (const leg of itinerary.legs) {
      // Frequent boarding stop: the origin stop of a transit (non-walk) leg.
      if (leg.mode !== "WALK" && leg.from?.stop?.gtfsId) {
        bump(stopCounts, leg.from.stop.gtfsId, leg.from.name, leg.mode);
      }
      // Frequent line: the route on a transit leg.
      if (leg.route?.gtfsId) {
        bump(lineCounts, leg.route.gtfsId, leg.route.shortName, leg.mode);
      }
    }
  }

  return {
    stops: toSuggestions(stopCounts, pinnedStopIds),
    lines: toSuggestions(lineCounts, pinnedLineIds),
  };
}

function toSuggestions(
  counts: Map<
    string,
    { name: string; vehicleMode: string | null; uses: number }
  >,
  alreadyPinned: Set<string>,
): PinSuggestion[] {
  return [...counts.entries()]
    .filter(([id, v]) => v.uses >= SUGGEST_MIN_USES && !alreadyPinned.has(id))
    .map(([gtfsId, v]) => ({
      gtfsId,
      name: v.name,
      vehicleMode: v.vehicleMode,
      uses: v.uses,
      windowDays: SUGGEST_WINDOW_DAYS,
    }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, SUGGEST_MAX);
}

/**
 * Nightly prune — drops each user's rows older than their retention window
 * (`preferences.extra.historyRetentionDays`, default 90). Iterates only users
 * that actually have rows. Returns the total removed across all users.
 */
export async function pruneExpired(): Promise<number> {
  const userIds = await tripLogRepo.listUserIdsWithRows();
  let removed = 0;
  for (const userId of userIds) {
    const prefs = await preferencesRepo.findByUserId(userId);
    const days =
      prefs?.extra.historyRetentionDays ?? DEFAULT_HISTORY_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - days * DAY_MS);
    removed += await tripLogRepo.deleteOlderThan(userId, cutoff);
  }
  return removed;
}

function toEntry(row: tripLogRepo.TripLogRow): TripLogEntry {
  return {
    id: row.id,
    from: { lat: row.fromLat, lon: row.fromLon, name: row.fromName },
    to: { lat: row.toLat, lon: row.toLon, name: row.toName },
    itinerary: row.itinerary as TransitItinerary,
    plannedAt: row.plannedAt.toISOString(),
  };
}
