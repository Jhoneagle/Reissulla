import * as savedLocationsRepo from "../db/repositories/saved-locations.repo.js";
import { reverseGeocode } from "./geocoding.service.js";
import { ConflictError } from "../utils/error-envelope.js";

export type SavedLocationCategory =
  | "home"
  | "work"
  | "school"
  | "cottage"
  | "family"
  | "hobby"
  | "other";

const VALID_CATEGORIES: ReadonlySet<SavedLocationCategory> = new Set([
  "home",
  "work",
  "school",
  "cottage",
  "family",
  "hobby",
  "other",
]);

const UNIQUE_VIOLATION = "23505";
const CATEGORY_INDEX_NAME = "saved_locations_user_category_home_work_idx";

export interface CreateLocationInput {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: SavedLocationCategory | null;
}

/**
 * Save a new location, stamping `region` from a reverse-geocode lookup so
 * users see "Helsinki — Töölö" style grouping later. Reverse-geocoding is
 * best-effort: a network error or no-results condition leaves region null
 * rather than blocking the save.
 *
 * Category constraints (LOC-5):
 * - Allowed values are checked here, not at the DB.
 * - The partial unique index on (user_id, category) WHERE category IN
 *   ('home', 'work') surfaces as a Postgres unique_violation; we translate
 *   it into CATEGORY_ALREADY_SET so the FE can show a useful message.
 */
export async function createLocation(input: CreateLocationInput) {
  validateCategory(input.category);

  const region = await tryReverseGeocodeLocality(
    input.latitude,
    input.longitude,
  );

  try {
    return await savedLocationsRepo.insertWithLimitCheck({
      userId: input.userId,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      region,
      category: input.category ?? null,
    });
  } catch (err) {
    throw translateCategoryConflict(err, input.category);
  }
}

export interface UpdateLocationInput {
  userId: string;
  id: string;
  name?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  category?: SavedLocationCategory | null;
}

export async function updateLocation(input: UpdateLocationInput) {
  validateCategory(input.category);

  try {
    return await savedLocationsRepo.updateByIdForUser(input.id, input.userId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
    });
  } catch (err) {
    throw translateCategoryConflict(err, input.category);
  }
}

export async function listLocations(userId: string) {
  return savedLocationsRepo.listByUser(userId);
}

export async function deleteLocation(id: string, userId: string) {
  return savedLocationsRepo.deleteByIdForUser(id, userId);
}

function validateCategory(value: string | null | undefined): void {
  if (value === undefined || value === null) return;
  if (!VALID_CATEGORIES.has(value as SavedLocationCategory)) {
    throw new ConflictError(
      "INVALID_CATEGORY",
      `Category must be one of: ${Array.from(VALID_CATEGORIES).join(", ")}`,
    );
  }
}

async function tryReverseGeocodeLocality(
  lat: number,
  lon: number,
): Promise<string | null> {
  try {
    const { data } = await reverseGeocode(lat, lon);
    // Prefer the city/locality over the broader admin region — "Helsinki" is
    // more meaningful for grouping than "Uusimaa".
    return data.address.city ?? data.address.county ?? null;
  } catch {
    return null;
  }
}

function translateCategoryConflict(
  err: unknown,
  category: SavedLocationCategory | null | undefined,
): unknown {
  if (!isUniqueViolation(err)) return err;
  if (category !== "home" && category !== "work") return err;
  return new ConflictError(
    "CATEGORY_ALREADY_SET",
    `You already have a saved location set as ${category}. Edit that one or pick a different category.`,
  );
}

function isUniqueViolation(err: unknown): boolean {
  // Drizzle wraps the underlying postgres error in a DrizzleQueryError; the
  // pg driver error (with .code and .constraint_name) is at `.cause`. Inspect
  // both so we don't care which version of the chain we get handed.
  const candidates: unknown[] = [err, (err as { cause?: unknown })?.cause];
  for (const c of candidates) {
    if (typeof c !== "object" || c === null) continue;
    const e = c as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
    };
    if (e.code !== UNIQUE_VIOLATION) continue;
    const name = e.constraint_name ?? e.constraint ?? "";
    if (name === CATEGORY_INDEX_NAME) return true;
  }
  return false;
}
