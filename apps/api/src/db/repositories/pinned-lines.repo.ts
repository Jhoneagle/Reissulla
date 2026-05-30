import { and, desc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { pinnedLines } from "../schema.js";

export type PinnedLineRow = typeof pinnedLines.$inferSelect;

export async function listByUser(userId: string): Promise<PinnedLineRow[]> {
  return db
    .select()
    .from(pinnedLines)
    .where(eq(pinnedLines.userId, userId))
    .orderBy(desc(pinnedLines.pinnedAt));
}

export interface PinInput {
  userId: string;
  gtfsId: string;
  name: string;
  vehicleMode: string;
}

/**
 * Idempotent pin. Returns the existing row if the user has already pinned
 * this line (matches via the unique (user_id, gtfs_id) index); otherwise
 * inserts and returns the new row.
 */
export async function pin(input: PinInput): Promise<PinnedLineRow> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pinnedLines)
      .where(
        and(
          eq(pinnedLines.userId, input.userId),
          eq(pinnedLines.gtfsId, input.gtfsId),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [row] = await tx
      .insert(pinnedLines)
      .values({
        userId: input.userId,
        gtfsId: input.gtfsId,
        name: input.name,
        vehicleMode: input.vehicleMode,
      })
      .returning();
    return row!;
  });
}

export async function unpinById(
  id: string,
  userId: string,
): Promise<PinnedLineRow | undefined> {
  const [row] = await db
    .delete(pinnedLines)
    .where(and(eq(pinnedLines.id, id), eq(pinnedLines.userId, userId)))
    .returning();
  return row;
}

export async function unpinByGtfsId(
  gtfsId: string,
  userId: string,
): Promise<PinnedLineRow | undefined> {
  const [row] = await db
    .delete(pinnedLines)
    .where(and(eq(pinnedLines.gtfsId, gtfsId), eq(pinnedLines.userId, userId)))
    .returning();
  return row;
}
