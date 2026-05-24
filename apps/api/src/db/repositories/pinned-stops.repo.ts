import { and, desc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { pinnedStops } from "../schema.js";

export type PinnedStopRow = typeof pinnedStops.$inferSelect;

export async function listByUser(userId: string): Promise<PinnedStopRow[]> {
  return db
    .select()
    .from(pinnedStops)
    .where(eq(pinnedStops.userId, userId))
    .orderBy(desc(pinnedStops.pinnedAt));
}

export interface PinInput {
  userId: string;
  gtfsId: string;
  name: string;
  vehicleMode?: string | null;
}

/**
 * Idempotent pin. Returns the existing row if the user has already pinned
 * this stop (matches via the unique (user_id, gtfs_id) index); otherwise
 * inserts and returns the new row.
 */
export async function pin(input: PinInput): Promise<PinnedStopRow> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pinnedStops)
      .where(
        and(
          eq(pinnedStops.userId, input.userId),
          eq(pinnedStops.gtfsId, input.gtfsId),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [row] = await tx
      .insert(pinnedStops)
      .values({
        userId: input.userId,
        gtfsId: input.gtfsId,
        name: input.name,
        vehicleMode: input.vehicleMode ?? null,
      })
      .returning();
    return row!;
  });
}

export async function unpinById(
  id: string,
  userId: string,
): Promise<PinnedStopRow | undefined> {
  const [row] = await db
    .delete(pinnedStops)
    .where(and(eq(pinnedStops.id, id), eq(pinnedStops.userId, userId)))
    .returning();
  return row;
}

export async function unpinByGtfsId(
  gtfsId: string,
  userId: string,
): Promise<PinnedStopRow | undefined> {
  const [row] = await db
    .delete(pinnedStops)
    .where(and(eq(pinnedStops.gtfsId, gtfsId), eq(pinnedStops.userId, userId)))
    .returning();
  return row;
}
