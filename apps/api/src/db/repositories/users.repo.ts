import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { user } from "../schema.js";

export type UserRow = typeof user.$inferSelect;

/**
 * better-auth's Drizzle adapter owns inserts and credential-bearing updates
 * (password, OAuth identifiers, email verification). This repo only surfaces
 * lookups, profile-name updates, and account deletion — three operations
 * that don't touch auth state.
 */
export async function findById(id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return row;
}

export async function updateName(
  id: string,
  name: string,
): Promise<UserRow | undefined> {
  const [row] = await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, id))
    .returning();
  return row;
}

/**
 * Hard-delete the user row. Cascade FKs (session, account, verification by
 * userId where applicable, savedLocations, preferences, recentPlaces) clean
 * up dependent rows in one statement.
 */
export async function deleteById(id: string): Promise<UserRow | undefined> {
  const [row] = await db.delete(user).where(eq(user.id, id)).returning();
  return row;
}
