import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../index.js";
import { recentStops } from "../schema.js";

export type RecentStopRow = typeof recentStops.$inferSelect;

export interface VisitInput {
  userId: string;
  gtfsId: string;
  name: string;
  vehicleMode?: string | null;
  isStation?: boolean;
}

/**
 * Record a transit-stop visit. If the user has been to this stop before,
 * the row's visitCount increments and lastVisitedAt refreshes; otherwise a
 * new row is inserted. Name + vehicleMode are kept current — feed-side
 * renames or mode reclassifications follow the next visit.
 */
export async function recordVisit(input: VisitInput): Promise<RecentStopRow> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(recentStops)
      .where(
        and(
          eq(recentStops.userId, input.userId),
          eq(recentStops.gtfsId, input.gtfsId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(recentStops)
        .set({
          visitCount: sql`${recentStops.visitCount} + 1`,
          lastVisitedAt: new Date(),
          name: input.name,
          vehicleMode: input.vehicleMode ?? null,
          isStation: input.isStation ?? existing.isStation,
        })
        .where(eq(recentStops.id, existing.id))
        .returning();
      return updated!;
    }

    const [row] = await tx
      .insert(recentStops)
      .values({
        userId: input.userId,
        gtfsId: input.gtfsId,
        name: input.name,
        vehicleMode: input.vehicleMode ?? null,
        isStation: input.isStation ?? false,
      })
      .returning();
    return row!;
  });
}

export async function listByUser(
  userId: string,
  limit = 20,
): Promise<RecentStopRow[]> {
  return db
    .select()
    .from(recentStops)
    .where(eq(recentStops.userId, userId))
    .orderBy(desc(recentStops.lastVisitedAt))
    .limit(limit);
}
