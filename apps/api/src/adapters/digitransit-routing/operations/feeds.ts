import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawFeedsData } from "../types.js";

// Lists every feed currently mounted on a given OTP2 graph. Used by the
// list-feeds.ts helper to populate the dispatch prefix map without relying
// on introspection (which is not guaranteed on Digitransit's public API).
const FEEDS_QUERY = `
  query Feeds {
    feeds {
      feedId
    }
  }
`;

export async function feedsOperation(
  client: GraphQLClient,
  ctx: AdapterContext,
): Promise<string[]> {
  const raw = await client.graphql<RawFeedsData>(FEEDS_QUERY, {}, ctx);
  return raw.feeds.map((f) => f.feedId);
}
