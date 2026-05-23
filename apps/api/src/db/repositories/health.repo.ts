import { sql } from "drizzle-orm";
import { db } from "../index.js";

/**
 * Confirm the database connection is alive. Throws if Postgres is
 * unreachable; the health route catches and reports "error" status.
 */
export async function ping(): Promise<void> {
  await db.execute(sql`SELECT 1`);
}
