import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { user } from "../schema.js";

export type UserRow = typeof user.$inferSelect;

/**
 * Read-only access. better-auth's Drizzle adapter owns inserts and updates
 * on the user table; this repo only surfaces lookups for service code.
 */
export async function findById(id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return row;
}
