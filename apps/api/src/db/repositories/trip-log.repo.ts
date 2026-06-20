import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../index.js";
import { tripLog } from "../schema.js";

export type TripLogRow = typeof tripLog.$inferSelect;

export interface TripLogInsert {
  userId: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  fromName?: string | null;
  toName?: string | null;
  /** TransitItinerary snapshot; stored verbatim as jsonb. */
  itinerary: unknown;
}

export async function insert(input: TripLogInsert): Promise<TripLogRow> {
  const [row] = await db
    .insert(tripLog)
    .values({
      userId: input.userId,
      fromLat: input.fromLat,
      fromLon: input.fromLon,
      toLat: input.toLat,
      toLon: input.toLon,
      fromName: input.fromName ?? null,
      toName: input.toName ?? null,
      itinerary: input.itinerary,
    })
    .returning();
  return row!;
}

export async function listByUser(
  userId: string,
  opts: { limit?: number; sinceDays?: number } = {},
): Promise<TripLogRow[]> {
  const conditions = [eq(tripLog.userId, userId)];
  if (typeof opts.sinceDays === "number" && opts.sinceDays > 0) {
    const cutoff = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(tripLog.plannedAt, cutoff));
  }
  const base = db
    .select()
    .from(tripLog)
    .where(and(...conditions))
    .orderBy(desc(tripLog.plannedAt));
  return typeof opts.limit === "number" && opts.limit > 0
    ? base.limit(opts.limit)
    : base;
}

export async function clearByUser(userId: string): Promise<number> {
  const rows = await db
    .delete(tripLog)
    .where(eq(tripLog.userId, userId))
    .returning({ id: tripLog.id });
  return rows.length;
}

/** Delete a user's rows older than `cutoff`. Returns the number removed. */
export async function deleteOlderThan(
  userId: string,
  cutoff: Date,
): Promise<number> {
  const rows = await db
    .delete(tripLog)
    .where(and(eq(tripLog.userId, userId), lt(tripLog.plannedAt, cutoff)))
    .returning({ id: tripLog.id });
  return rows.length;
}

/** Distinct user ids that currently have at least one trip-log row. */
export async function listUserIdsWithRows(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: tripLog.userId })
    .from(tripLog);
  return rows.map((r) => r.userId);
}
