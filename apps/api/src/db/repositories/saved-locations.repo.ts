import { and, count, eq } from "drizzle-orm";
import { db } from "../index.js";
import { savedLocations } from "../schema.js";
import { ConflictError } from "../../utils/error-envelope.js";

export type SavedLocationRow = typeof savedLocations.$inferSelect;

const MAX_SAVED_LOCATIONS = 20;

export async function listByUser(userId: string): Promise<SavedLocationRow[]> {
  return db
    .select()
    .from(savedLocations)
    .where(eq(savedLocations.userId, userId))
    .orderBy(savedLocations.sortOrder, savedLocations.createdAt);
}

export async function countByUser(userId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(savedLocations)
    .where(eq(savedLocations.userId, userId));
  return result[0]?.value ?? 0;
}

export interface InsertInput {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Insert a new saved location, enforcing the per-user limit and assigning
 * primary/sortOrder based on what already exists.
 *
 * Throws ConflictError("LIMIT_REACHED") when the user already has the maximum.
 */
export async function insertWithLimitCheck(
  input: InsertInput,
): Promise<SavedLocationRow> {
  const existing = await countByUser(input.userId);

  if (existing >= MAX_SAVED_LOCATIONS) {
    throw new ConflictError(
      "LIMIT_REACHED",
      `You can save up to ${MAX_SAVED_LOCATIONS} locations`,
    );
  }

  const [row] = await db
    .insert(savedLocations)
    .values({
      userId: input.userId,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      isPrimary: existing === 0,
      sortOrder: existing,
    })
    .returning();

  return row!;
}

export interface UpdateInput {
  name?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

/**
 * Update fields on a saved location. If `isPrimary` is being set to true,
 * the user's other saved locations are cleared of their primary flag in the
 * same transaction.
 *
 * Returns undefined when no row matches (id + userId).
 */
export async function updateByIdForUser(
  id: string,
  userId: string,
  updates: UpdateInput,
): Promise<SavedLocationRow | undefined> {
  return db.transaction(async (tx) => {
    if (updates.isPrimary) {
      await tx
        .update(savedLocations)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(savedLocations.userId, userId));
    }

    const [row] = await tx
      .update(savedLocations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)))
      .returning();

    return row;
  });
}

/**
 * Delete a saved location. If the deleted row was the user's primary, the
 * next-by-(sortOrder, createdAt) row is promoted to primary in the same
 * transaction.
 *
 * Returns the deleted row, or undefined when no row matches.
 */
export async function deleteByIdForUser(
  id: string,
  userId: string,
): Promise<SavedLocationRow | undefined> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(savedLocations)
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)))
      .returning();

    if (row?.isPrimary) {
      const [next] = await tx
        .select({ id: savedLocations.id })
        .from(savedLocations)
        .where(eq(savedLocations.userId, userId))
        .orderBy(savedLocations.sortOrder, savedLocations.createdAt)
        .limit(1);

      if (next) {
        await tx
          .update(savedLocations)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(savedLocations.id, next.id));
      }
    }

    return row;
  });
}
