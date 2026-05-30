import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawTrip, RawTripData } from "../types.js";

// Drill-down for a single trip — every stop along the trip's pattern plus
// scheduled + realtime times, used by the departure-row click-through.
const TRIP_QUERY = `
  query Trip($id: String!) {
    trip(id: $id) {
      gtfsId
      tripHeadsign
      directionId
      activeDates
      route {
        gtfsId
        shortName
        longName
        mode
        color
        textColor
        agency { gtfsId name }
      }
      stoptimes {
        stop {
          gtfsId
          name
          lat
          lon
          code
          platformCode
        }
        scheduledArrival
        scheduledDeparture
        realtimeArrival
        realtimeDeparture
        arrivalDelay
        departureDelay
        realtime
        timepoint
        stopPositionInPattern
        pickupType
        dropoffType
      }
    }
  }
`;

export async function tripOperation(
  client: GraphQLClient,
  args: { tripId: string },
  ctx: AdapterContext,
): Promise<RawTrip | null> {
  const raw = await client.graphql<RawTripData>(
    TRIP_QUERY,
    { id: args.tripId },
    ctx,
  );
  return raw.trip;
}
