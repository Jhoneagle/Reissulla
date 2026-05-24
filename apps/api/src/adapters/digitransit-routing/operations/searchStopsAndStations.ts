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
      wheelchairBoarding
    }
    stations(name: $name) {
      gtfsId
      name
      lat
      lon
      vehicleMode
      wheelchairBoarding
      stops {
        gtfsId
        name
        code
        platformCode
        vehicleMode
        wheelchairBoarding
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
