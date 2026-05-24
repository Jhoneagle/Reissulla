import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../index.js";
import { recentPlaces } from "../schema.js";

export type RecentPlaceRow = typeof recentPlaces.$inferSelect;

// Coordinate rounding for dedup: ~11 metre precision at Finland's latitude.
// Recording every metre would treat "Hakaniemi entrance" and "Hakaniemi
// stairs" as different places; this lets the service auto-history dedup
// match how the user actually thinks about a location.
const COORD_PRECISION = 4;

function round(n: number): number {
  return Number(n.toFixed(COORD_PRECISION));
}

export interface RecordVisitInput {
  userId: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

/**
 * Record a visit to a place. If the user has already been to roughly the
 * same coordinates, increments the visit counter and refreshes the
 * lastVisitedAt; otherwise inserts a new row.
 *
 * Returns the row after the update, so callers can branch on `visitCount`
 * to decide whether to prompt the user to save it (LOC-8 fires the prompt
 * at visit_count >= 3).
 */
export async function recordVisit(
  input: RecordVisitInput,
): Promise<RecentPlaceRow> {
  const lat = round(input.latitude);
  const lon = round(input.longitude);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(recentPlaces)
      .where(
        and(
          eq(recentPlaces.userId, input.userId),
          eq(recentPlaces.latitude, lat),
          eq(recentPlaces.longitude, lon),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(recentPlaces)
        .set({
          visitCount: sql`${recentPlaces.visitCount} + 1`,
          lastVisitedAt: new Date(),
          // Keep the most recent display name — Pelias can shift wording over time.
          displayName: input.displayName,
        })
        .where(eq(recentPlaces.id, existing.id))
        .returning();
      return updated!;
    }

    const [inserted] = await tx
      .insert(recentPlaces)
      .values({
        userId: input.userId,
        latitude: lat,
        longitude: lon,
        displayName: input.displayName,
      })
      .returning();
    return inserted!;
  });
}

export async function listByUser(
  userId: string,
  limit = 20,
): Promise<RecentPlaceRow[]> {
  return db
    .select()
    .from(recentPlaces)
    .where(eq(recentPlaces.userId, userId))
    .orderBy(desc(recentPlaces.lastVisitedAt))
    .limit(limit);
}

export async function deleteByIdForUser(
  id: string,
  userId: string,
): Promise<RecentPlaceRow | undefined> {
  const [row] = await db
    .delete(recentPlaces)
    .where(and(eq(recentPlaces.id, id), eq(recentPlaces.userId, userId)))
    .returning();
  return row;
}

export async function clearForUser(userId: string): Promise<void> {
  await db.delete(recentPlaces).where(eq(recentPlaces.userId, userId));
}
