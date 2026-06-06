/**
 * One-shot helper that lists every feedId mounted on each enabled
 * Digitransit OTP2 graph.
 *
 * Run when adding a new regional adapter, when Digitransit announces a
 * feed addition, or when a smoke test surfaces a stop id that gets routed
 * to the wrong adapter. The resulting prefix sets land hand-pasted into
 * `dispatch.ts` so a stale upstream change becomes a code diff rather
 * than a silently broken route.
 *
 *   pnpm --filter @reissulla/api exec tsx scripts/list-feeds.ts
 */
import { digitransitFinland } from "../src/adapters/digitransit-finland/index.js";
import { digitransitHsl } from "../src/adapters/digitransit-hsl/index.js";
import { digitransitVarely } from "../src/adapters/digitransit-varely/index.js";
import { digitransitWaltti } from "../src/adapters/digitransit-waltti/index.js";
import { createGraphQLClient } from "../src/adapters/digitransit-routing/client.js";
import { feedsOperation } from "../src/adapters/digitransit-routing/operations/feeds.js";
import type { AdapterContext } from "../src/adapters/types.js";

const ALL = [
  digitransitFinland,
  digitransitHsl,
  digitransitWaltti,
  digitransitVarely,
];

async function main(): Promise<void> {
  const ctx: AdapterContext = {
    signal: new AbortController().signal,
    locale: "fi",
  };
  for (const adapter of ALL) {
    if (!adapter.enabled()) {
      console.log(`\n[${adapter.name}] disabled — skipping`);
      continue;
    }
    const client = createGraphQLClient(adapter.name, adapter.graphUrl);
    try {
      const feedIds = await feedsOperation(client, ctx);
      const prefixes = feedIds.map((id) => id.split(":")[0] ?? id).sort();
      const unique = Array.from(new Set(prefixes));
      console.log(`\n[${adapter.name}] ${unique.length} feed(s):`);
      for (const prefix of unique) {
        console.log(`  ${prefix}`);
      }
    } catch (err) {
      console.error(`\n[${adapter.name}] failed: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
