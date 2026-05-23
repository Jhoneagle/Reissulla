import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { preferences } from "../schema.js";

export type PreferencesRow = typeof preferences.$inferSelect;
export type PreferencesPatch = Partial<
  Omit<typeof preferences.$inferInsert, "id" | "userId" | "updatedAt">
>;

export async function findByUserId(
  userId: string,
): Promise<PreferencesRow | undefined> {
  const [row] = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1);
  return row;
}

/**
 * Create or update a user's preferences row.
 *
 * The preferences table has a unique constraint on userId, so we let the
 * database handle the upsert via ON CONFLICT.
 */
export async function upsert(
  userId: string,
  patch: PreferencesPatch,
): Promise<PreferencesRow> {
  const [row] = await db
    .insert(preferences)
    .values({ userId, ...patch })
    .onConflictDoUpdate({
      target: preferences.userId,
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row!;
}
