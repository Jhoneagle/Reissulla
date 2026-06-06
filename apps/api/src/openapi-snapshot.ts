/**
 * Build the API once, dump the OpenAPI document to apps/api/openapi.json,
 * and exit. Run via `pnpm --filter @reissulla/api openapi:snapshot` so PR
 * reviewers can see API surface changes alongside the route diff.
 *
 * The snapshot is the single source of truth in the repo; the live server
 * also serves the same spec at /api/v1/openapi.json so external clients
 * can fetch it dynamically.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildServer } from "./app.js";

const OUT_PATH = resolve(import.meta.dirname, "../openapi.json");

async function main() {
  const server = await buildServer();
  await server.ready();
  const spec = server.swagger();
  await writeFile(OUT_PATH, JSON.stringify(spec, null, 2) + "\n", "utf8");
  await server.close();
  console.log(`Wrote OpenAPI snapshot → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
