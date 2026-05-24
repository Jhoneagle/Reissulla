import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawStopsByRadiusData, RawStopsByRadiusPage } from "../types.js";

// Paged radius search. Backs the adaptive-radius behaviour (start at 500 m,
// double up to 2 km until >=5 stops found) and is preferred over `nearest`
// when the caller wants the full set inside a radius, not the closest few.
const STOPS_BY_RADIUS_QUERY = `
  query StopsByRadius(
    $lat: Float!
    $lon: Float!
    $radius: Int!
    $first: Int
    $after: String
  ) {
    stopsByRadius(
      lat: $lat
      lon: $lon
      radius: $radius
      first: $first
      after: $after
    ) {
      edges {
        cursor
        node {
          distance
          stop {
            gtfsId
            name
            code
            lat
            lon
            vehicleMode
            platformCode
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function stopsByRadiusOperation(
  client: GraphQLClient,
  args: {
    lat: number;
    lon: number;
    radius: number;
    first?: number;
    after?: string | null;
  },
  ctx: AdapterContext,
): Promise<RawStopsByRadiusPage> {
  const raw = await client.graphql<RawStopsByRadiusData>(
    STOPS_BY_RADIUS_QUERY,
    {
      lat: args.lat,
      lon: args.lon,
      radius: args.radius,
      first: args.first ?? null,
      after: args.after ?? null,
    },
    ctx,
  );
  return (
    raw.stopsByRadius ?? {
      edges: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    }
  );
}
