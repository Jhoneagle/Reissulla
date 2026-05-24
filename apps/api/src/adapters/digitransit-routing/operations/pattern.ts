import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawPattern, RawPatternData } from "../types.js";

// Single pattern with its ordered stop sequence — the data backing the
// line-view stop list for one direction.
const PATTERN_QUERY = `
  query Pattern($id: String!) {
    pattern(id: $id) {
      code
      headsign
      directionId
      stops {
        gtfsId
        name
        lat
        lon
        code
        platformCode
      }
    }
  }
`;

export async function patternOperation(
  client: GraphQLClient,
  args: { patternId: string },
  ctx: AdapterContext,
): Promise<RawPattern | null> {
  const raw = await client.graphql<RawPatternData>(
    PATTERN_QUERY,
    { id: args.patternId },
    ctx,
  );
  return raw.pattern;
}
