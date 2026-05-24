import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawRouteData, RawRouteWithPatterns } from "../types.js";

// Patterns are returned without their stop sequences — fetch a stop sequence
// via `patternOperation` (or `patternsOperation` for all directions at once)
// once the user has picked which direction to view.
const ROUTE_QUERY = `
  query Route($id: String!) {
    route(id: $id) {
      gtfsId
      shortName
      longName
      mode
      color
      textColor
      agency { gtfsId name }
      patterns {
        code
        headsign
        directionId
      }
    }
  }
`;

export async function routeOperation(
  client: GraphQLClient,
  args: { routeId: string },
  ctx: AdapterContext,
): Promise<RawRouteWithPatterns | null> {
  const raw = await client.graphql<RawRouteData>(
    ROUTE_QUERY,
    { id: args.routeId },
    ctx,
  );
  return raw.route;
}
