import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { preferences } from "../schema.js";
import {
  parseExtra,
  serializeExtra,
  type PreferencesExtra,
} from "./preferences-extra.js";

type PreferencesRowRaw = typeof preferences.$inferSelect;
type PreferencesInsertRaw = typeof preferences.$inferInsert;

export type PreferencesRow = Omit<PreferencesRowRaw, "extra"> & {
  extra: PreferencesExtra;
};

export type PreferencesPatch = Partial<
  Omit<PreferencesInsertRaw, "id" | "userId" | "updatedAt" | "extra"> & {
    extra?: PreferencesExtra;
  }
>;

function toRow(raw: PreferencesRowRaw): PreferencesRow {
  return { ...raw, extra: parseExtra(raw.extra) };
}

export async function findByUserId(
  userId: string,
): Promise<PreferencesRow | undefined> {
  const [row] = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1);
  return row ? toRow(row) : undefined;
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
  const { extra, ...rest } = patch;
  const dbValues: Partial<PreferencesInsertRaw> = { ...rest };
  if (extra !== undefined) {
    dbValues.extra = serializeExtra(extra);
  }

  const [row] = await db
    .insert(preferences)
    .values({ userId, ...dbValues })
    .onConflictDoUpdate({
      target: preferences.userId,
      set: { ...dbValues, updatedAt: new Date() },
    })
    .returning();
  return toRow(row!);
}
