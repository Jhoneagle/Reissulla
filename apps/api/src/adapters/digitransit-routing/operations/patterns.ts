import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawPattern, RawPatternsData } from "../types.js";

// All patterns for a route, each with its stop sequence — one request to
// render the direction toggle plus both directions on the line view.
const PATTERNS_QUERY = `
  query Patterns($routeId: String!) {
    route(id: $routeId) {
      patterns {
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
  }
`;

export async function patternsOperation(
  client: GraphQLClient,
  args: { routeId: string },
  ctx: AdapterContext,
): Promise<RawPattern[]> {
  const raw = await client.graphql<RawPatternsData>(
    PATTERNS_QUERY,
    { routeId: args.routeId },
    ctx,
  );
  return raw.route?.patterns ?? [];
}
