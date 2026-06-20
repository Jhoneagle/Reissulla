import * as usersRepo from "../db/repositories/users.repo.js";
import * as savedLocationsRepo from "../db/repositories/saved-locations.repo.js";
import * as recentPlacesRepo from "../db/repositories/recent-places.repo.js";
import * as pinnedStopsRepo from "../db/repositories/pinned-stops.repo.js";
import * as pinnedLinesRepo from "../db/repositories/pinned-lines.repo.js";
import * as recentStopsRepo from "../db/repositories/recent-stops.repo.js";
import * as alertSeenRepo from "../db/repositories/alert-seen.repo.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";
import * as tripLogRepo from "../db/repositories/trip-log.repo.js";
import type { PreferencesExtra } from "../db/repositories/preferences-extra.js";
import type { TransitItinerary } from "@reissulla/shared";
import { NotFoundError } from "../utils/error-envelope.js";

/** Practical export budget — far above any realistic per-user trip count. */
const TRIP_LOG_EXPORT_LIMIT = 10_000;

/**
 * GDPR-style account export. Every user-owned table the API knows about
 * appears here. Still-unbuilt tables (trip log, share tokens) are pre-declared
 * as empty arrays so adding the underlying table later is the only change
 * needed — the export-roundtrip E2E catches a regression where a new table is
 * silently dropped from the export.
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
  pinnedStops: ExportedPinnedStop[];
  recentStops: ExportedRecentStop[];
  /** Populated when the lines view ships. */
  pinnedLines: ExportedPinnedLine[];
  tripLog: ExportedTripLogEntry[];
  alertSeen: ExportedAlertSeenEntry[];
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

interface ExportedPinnedStop {
  gtfsId: string;
  name: string;
  vehicleMode: string | null;
  isStation: boolean;
  pinnedAt: string;
}
interface ExportedRecentStop {
  gtfsId: string;
  name: string;
  vehicleMode: string | null;
  isStation: boolean;
  visitCount: number;
  lastVisitedAt: string;
}
// Future-table shape — declared empty here so the AccountExport contract is
// stable and adding the table later doesn't change the JSON envelope.
interface ExportedPinnedLine {
  gtfsId: string;
  name: string;
  vehicleMode: string;
  pinnedAt: string;
}
interface ExportedTripLogEntry {
  id: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  fromName: string | null;
  toName: string | null;
  /** Snapshot of the itinerary at plan time. */
  itinerary: TransitItinerary;
  plannedAt: string;
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

  const [
    preferences,
    savedLocations,
    recentPlaces,
    pinnedStopRows,
    pinnedLineRows,
    recentStopRows,
    alertSeenRows,
    tripLogRows,
  ] = await Promise.all([
    preferencesRepo.findByUserId(userId),
    savedLocationsRepo.listByUser(userId),
    recentPlacesRepo.listByUser(userId, 1000),
    pinnedStopsRepo.listByUser(userId),
    pinnedLinesRepo.listByUser(userId),
    recentStopsRepo.listByUser(userId, 1000),
    alertSeenRepo.listByUser(userId),
    tripLogRepo.listByUser(userId, { limit: TRIP_LOG_EXPORT_LIMIT }),
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
    pinnedStops: pinnedStopRows.map((row) => ({
      gtfsId: row.gtfsId,
      name: row.name,
      vehicleMode: row.vehicleMode,
      isStation: row.isStation,
      pinnedAt: row.pinnedAt.toISOString(),
    })),
    recentStops: recentStopRows.map((row) => ({
      gtfsId: row.gtfsId,
      name: row.name,
      vehicleMode: row.vehicleMode,
      isStation: row.isStation,
      visitCount: row.visitCount,
      lastVisitedAt: row.lastVisitedAt.toISOString(),
    })),
    pinnedLines: pinnedLineRows.map((row) => ({
      gtfsId: row.gtfsId,
      name: row.name,
      vehicleMode: row.vehicleMode,
      pinnedAt: row.pinnedAt.toISOString(),
    })),
    tripLog: tripLogRows.map((row) => ({
      id: row.id,
      fromLat: row.fromLat,
      fromLon: row.fromLon,
      toLat: row.toLat,
      toLon: row.toLon,
      fromName: row.fromName,
      toName: row.toName,
      itinerary: row.itinerary as TransitItinerary,
      plannedAt: row.plannedAt.toISOString(),
    })),
    alertSeen: alertSeenRows.map((row) => ({
      alertId: row.alertId,
      seenAt: row.seenAt.toISOString(),
    })),
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
