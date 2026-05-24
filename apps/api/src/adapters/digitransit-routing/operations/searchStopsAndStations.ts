import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawSearchStopsAndStationsData } from "../types.js";

// `routes { agency }` feeds the operator dropdown — collected client-side
// per grouped stop, deduplicated by agency gtfsId. Pulling routes here
// rather than per-result keeps the search cost to one round-trip; rural
// stops with one or two routes pay almost nothing, busy hubs like Pasila
// hand back ~10-15 routes which is comfortably below complexity limits.
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
      routes {
        agency { gtfsId name }
      }
    }
    stations(name: $name) {
      gtfsId
      name
      lat
      lon
      vehicleMode
      wheelchairBoarding
      routes {
        agency { gtfsId name }
      }
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
