import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawSearchStopsAndStationsData } from "../types.js";

const SEARCH_QUERY = `
  query SearchStopsAndStations($name: String!) {
    stops(name: $name) {
      gtfsId
      name
      code
      lat
      lon
      vehicleMode
      platformCode
    }
    stations(name: $name) {
      gtfsId
      name
      lat
      lon
      vehicleMode
      stops {
        gtfsId
        name
        code
        platformCode
        vehicleMode
      }
    }
  }
`;

export async function searchStopsAndStationsOperation(
  client: GraphQLClient,
  args: { name: string },
  ctx: AdapterContext,
): Promise<RawSearchStopsAndStationsData> {
  return client.graphql<RawSearchStopsAndStationsData>(
    SEARCH_QUERY,
    { name: args.name },
    ctx,
  );
}
