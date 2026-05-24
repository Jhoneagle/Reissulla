import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawTripForDate, RawTripsForDateData } from "../types.js";

// All trips that run a given pattern on a specific service date — used to
// derive frequency bands ("every 7 min 07–09, every 12 min 09–14") and to
// surface "schooldays only" hints on sparse rural lines.
const TRIPS_FOR_DATE_QUERY = `
  query TripsForDate($patternId: String!, $serviceDate: String!) {
    pattern(id: $patternId) {
      code
      tripsForDate(serviceDate: $serviceDate) {
        gtfsId
        tripHeadsign
        activeDates
      }
    }
  }
`;

export async function tripsForDateOperation(
  client: GraphQLClient,
  args: { patternId: string; serviceDate: string },
  ctx: AdapterContext,
): Promise<RawTripForDate[]> {
  const raw = await client.graphql<RawTripsForDateData>(
    TRIPS_FOR_DATE_QUERY,
    { patternId: args.patternId, serviceDate: args.serviceDate },
    ctx,
  );
  return raw.pattern?.tripsForDate ?? [];
}
