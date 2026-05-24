import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawCanceledTripEdge, RawCanceledTripsData } from "../types.js";

// Stoptimes for trips the feed has marked as canceled. Lands now to keep
// the operations directory complete; consumer (real-time cancellation
// surfacing) wires in a later phase.
const CANCELED_TRIPS_QUERY = `
  query CanceledTrips($first: Int) {
    canceledTripTimes(first: $first) {
      edges {
        node {
          trip { gtfsId }
          scheduledDeparture
          serviceDay
        }
      }
    }
  }
`;

export async function canceledTripsOperation(
  client: GraphQLClient,
  args: { first?: number },
  ctx: AdapterContext,
): Promise<RawCanceledTripEdge[]> {
  const raw = await client.graphql<RawCanceledTripsData>(
    CANCELED_TRIPS_QUERY,
    { first: args.first ?? null },
    ctx,
  );
  return raw.canceledTripTimes?.edges ?? [];
}
