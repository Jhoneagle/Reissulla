import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type {
  RawRouteWithPatternsAndStops,
  RawRouteWithPatternsAndStopsData,
} from "../types.js";

// Combined route metadata + patterns + stop sequences. LineView wants all of
// this on first paint (masthead numerals from the metadata, direction toggle
// from patterns, stop spine from each pattern's stops), so we hit the
// upstream once instead of pairing routeOperation with patternsOperation.
const ROUTE_WITH_PATTERNS_QUERY = `
  query RouteWithPatterns($id: String!) {
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

export async function routeWithPatternsOperation(
  client: GraphQLClient,
  args: { routeId: string },
  ctx: AdapterContext,
): Promise<RawRouteWithPatternsAndStops | null> {
  const raw = await client.graphql<RawRouteWithPatternsAndStopsData>(
    ROUTE_WITH_PATTERNS_QUERY,
    { id: args.routeId },
    ctx,
  );
  return raw.route;
}
