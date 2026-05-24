import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawRouteMeta, RawRoutesData } from "../types.js";

// `routes(name: String)` filters by short name OR long name (substring match).
// Used for the line catalogue search ("550" → bus 550 across feeds).
const ROUTES_QUERY = `
  query Routes($name: String!) {
    routes(name: $name) {
      gtfsId
      shortName
      longName
      mode
      color
      textColor
      agency { gtfsId name }
    }
  }
`;

export async function routesOperation(
  client: GraphQLClient,
  args: { name: string },
  ctx: AdapterContext,
): Promise<RawRouteMeta[]> {
  const raw = await client.graphql<RawRoutesData>(
    ROUTES_QUERY,
    { name: args.name },
    ctx,
  );
  return raw.routes;
}
