import * as usersRepo from "../db/repositories/users.repo.js";
import * as savedLocationsRepo from "../db/repositories/saved-locations.repo.js";
import * as recentPlacesRepo from "../db/repositories/recent-places.repo.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";
import type { PreferencesExtra } from "../db/repositories/preferences-extra.js";
import { NotFoundError } from "../utils/error-envelope.js";

/**
 * GDPR-style account export. Every user-owned table the API knows about
 * appears here. Phase 2-5 tables (pinned stops/lines, trip log, alerts seen,
 * share tokens) are pre-declared as empty arrays so adding the underlying
 * table later is the only change needed — the export-roundtrip E2E catches
 * a regression where the new table is silently dropped from the export.
 *
 * `schemaVersion` lets external readers detect shape changes.
 */
export interface AccountExport {
  schemaVersion: 1;
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  preferences: ExportedPreferences | null;
  savedLocations: ExportedSavedLocation[];
  recentPlaces: ExportedRecentPlace[];
  /** Phase 2. */
  pinnedStops: ExportedPinnedStop[];
  /** Phase 2. */
  pinnedLines: ExportedPinnedLine[];
  /** Phase 4. */
  tripLog: ExportedTripLogEntry[];
  /** Phase 4. */
  alertSeen: ExportedAlertSeenEntry[];
  /** Phase 5. */
  shareTokens: ExportedShareTokenSummary[];
}

interface ExportedPreferences {
  temperatureUnit: string;
  distanceUnit: string;
  language: string;
  timeFormat: string;
  transitRegion: string;
  theme: string;
  reduceMotion: string;
  highContrast: boolean;
  fontScale: number;
  srOptimised: boolean;
  extra: PreferencesExtra;
  updatedAt: string;
}

interface ExportedSavedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
  sortOrder: number;
  region: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExportedRecentPlace {
  id: string;
  latitude: number;
  longitude: number;
  displayName: string;
  visitCount: number;
  lastVisitedAt: string;
}

// Future-phase shapes — declared empty here so the AccountExport contract is
// stable and adding the table doesn't change the JSON envelope.
interface ExportedPinnedStop {
  gtfsId: string;
  label: string;
  sortOrder: number;
  createdAt: string;
}
interface ExportedPinnedLine {
  gtfsId: string;
  label: string;
  sortOrder: number;
  createdAt: string;
}
interface ExportedTripLogEntry {
  id: string;
  plannedAt: string;
  createdAt: string;
}
interface ExportedAlertSeenEntry {
  alertId: string;
  seenAt: string;
}
interface ExportedShareTokenSummary {
  jti: string;
  kind: string;
  expiresAt: string;
}

export async function exportAccount(userId: string): Promise<AccountExport> {
  const userRow = await usersRepo.findById(userId);
  if (!userRow) {
    throw new NotFoundError("User not found");
  }

  const [preferences, savedLocations, recentPlaces] = await Promise.all([
    preferencesRepo.findByUserId(userId),
    savedLocationsRepo.listByUser(userId),
    recentPlacesRepo.listByUser(userId, 1000),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      emailVerified: userRow.emailVerified,
      createdAt: userRow.createdAt.toISOString(),
      updatedAt: userRow.updatedAt.toISOString(),
    },
    preferences: preferences
      ? {
          temperatureUnit: preferences.temperatureUnit,
          distanceUnit: preferences.distanceUnit,
          language: preferences.language,
          timeFormat: preferences.timeFormat,
          transitRegion: preferences.transitRegion,
          theme: preferences.theme,
          reduceMotion: preferences.reduceMotion,
          highContrast: preferences.highContrast,
          fontScale: preferences.fontScale,
          srOptimised: preferences.srOptimised,
          extra: preferences.extra,
          updatedAt: preferences.updatedAt.toISOString(),
        }
      : null,
    savedLocations: savedLocations.map((row) => ({
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      isPrimary: row.isPrimary,
      sortOrder: row.sortOrder,
      region: row.region,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    recentPlaces: recentPlaces.map((row) => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      displayName: row.displayName,
      visitCount: row.visitCount,
      lastVisitedAt: row.lastVisitedAt.toISOString(),
    })),
    pinnedStops: [],
    pinnedLines: [],
    tripLog: [],
    alertSeen: [],
    shareTokens: [],
  };
}

/**
 * Hard-delete the account and everything it owns. Cascade FKs on session,
 * account, savedLocations, preferences, recentPlaces handle the dependents.
 * Throws NotFoundError if the user is already gone.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const deleted = await usersRepo.deleteById(userId);
  if (!deleted) {
    throw new NotFoundError("User not found");
  }
}
