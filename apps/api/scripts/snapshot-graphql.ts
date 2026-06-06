/**
 * Refreshes the Digitransit schema-drift baseline.
 *
 * - Downloads the OTP2 GTFS GraphQL SDL from the upstream HSLdevcom repo
 *   and writes it as `adapters/digitransit-<name>/schema.snapshot.graphql`
 *   for every adapter (co-located so the contract lives next to the
 *   consumer; the SDL bytes are identical across all four files).
 * - Queries `feeds { feedId }` against each enabled adapter and writes
 *   the sorted result to `adapters/digitransit-<name>/feeds.snapshot.json`.
 *
 * CI re-runs this script and then `git diff --exit-code` on the snapshot
 * files — any change to upstream OTP2 schema or any feed addition /
 * removal becomes a build break rather than a runtime 500.
 *
 *   pnpm --filter @reissulla/api test:graphql-snapshot
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { digitransitFinland } from "../src/adapters/digitransit-finland/index.js";
import { digitransitHsl } from "../src/adapters/digitransit-hsl/index.js";
import { digitransitVarely } from "../src/adapters/digitransit-varely/index.js";
import { digitransitWaltti } from "../src/adapters/digitransit-waltti/index.js";
import { createGraphQLClient } from "../src/adapters/digitransit-routing/client.js";
import { feedsOperation } from "../src/adapters/digitransit-routing/operations/feeds.js";
import type { AdapterContext } from "../src/adapters/types.js";

const SDL_URL =
  "https://raw.githubusercontent.com/HSLdevcom/OpenTripPlanner/v2/application/src/main/resources/org/opentripplanner/apis/gtfs/schema.graphqls";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADAPTERS_DIR = join(__dirname, "..", "src", "adapters");

const ALL = [
  digitransitFinland,
  digitransitHsl,
  digitransitWaltti,
  digitransitVarely,
];

async function downloadSdl(): Promise<string> {
  const res = await fetch(SDL_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to download upstream SDL: ${res.status} ${res.statusText}`,
    );
  }
  return res.text();
}

async function main(): Promise<void> {
  const sdl = await downloadSdl();
  const ctx: AdapterContext = {
    signal: new AbortController().signal,
    locale: "fi",
  };

  for (const adapter of ALL) {
    const adapterDir = join(ADAPTERS_DIR, adapter.name);
    writeFileSync(join(adapterDir, "schema.snapshot.graphql"), sdl);
    console.log(`[${adapter.name}] SDL written`);

    if (!adapter.enabled()) {
      console.log(`[${adapter.name}] disabled — skipping feeds query`);
      continue;
    }

    try {
      const client = createGraphQLClient(adapter.name, adapter.graphUrl);
      const feedIds = (await feedsOperation(client, ctx)).sort();
      writeFileSync(
        join(adapterDir, "feeds.snapshot.json"),
        JSON.stringify({ feeds: feedIds }, null, 2) + "\n",
      );
      console.log(`[${adapter.name}] feeds.json written (${feedIds.length})`);
    } catch (err) {
      console.error(
        `[${adapter.name}] feeds query failed — leaving feeds.snapshot.json untouched: ${(err as Error).message}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
