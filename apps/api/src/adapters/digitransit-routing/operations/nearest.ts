import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawNearestData, RawNearestEdge } from "../types.js";

const NEAREST_QUERY = `
  query NearbyStops($lat: Float!, $lon: Float!, $radius: Int!) {
    nearest(lat: $lat, lon: $lon, maxDistance: $radius, filterByPlaceTypes: [STOP]) {
      edges {
        node {
          distance
          place {
            ... on Stop {
              gtfsId
              name
              code
              lat
              lon
              vehicleMode
              platformCode
              wheelchairBoarding
            }
          }
        }
      }
    }
  }
`;

export async function nearestOperation(
  client: GraphQLClient,
  args: { lat: number; lon: number; radius: number },
  ctx: AdapterContext,
): Promise<RawNearestEdge[]> {
  const raw = await client.graphql<RawNearestData>(
    NEAREST_QUERY,
    { lat: args.lat, lon: args.lon, radius: args.radius },
    ctx,
  );
  return raw.nearest.edges.map((edge) => edge.node);
}
