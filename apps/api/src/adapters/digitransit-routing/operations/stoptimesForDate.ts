import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type {
  RawStoptimesForDateData,
  RawStoptimesForDateInPattern,
} from "../types.js";

// All stoptimes at a stop on a given service date, grouped by pattern.
// Backs first/last-of-day chips (DEP-9) and sparse-frequency rendering when
// the next departure is more than a day out.
const STOPTIMES_FOR_DATE_QUERY = `
  query StoptimesForDate($stopId: String!, $date: String!) {
    stop(id: $stopId) {
      name
      stoptimesForServiceDate(date: $date) {
        pattern {
          code
          headsign
          directionId
          route {
            gtfsId
            shortName
            longName
            mode
            color
            textColor
            agency { gtfsId name }
          }
        }
        stoptimes {
          scheduledDeparture
          realtimeDeparture
          departureDelay
          realtime
          serviceDay
          headsign
          trip { gtfsId }
        }
      }
    }
  }
`;

export async function stoptimesForDateOperation(
  client: GraphQLClient,
  args: { stopId: string; date: string },
  ctx: AdapterContext,
): Promise<RawStoptimesForDateInPattern[]> {
  const raw = await client.graphql<RawStoptimesForDateData>(
    STOPTIMES_FOR_DATE_QUERY,
    { stopId: args.stopId, date: args.date },
    ctx,
  );
  return raw.stop?.stoptimesForServiceDate ?? [];
}
