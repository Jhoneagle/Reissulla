import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawStopDeparturesData } from "../types.js";

const STOP_DEPARTURES_QUERY = `
  query StopDepartures($id: String!, $n: Int!) {
    stop(id: $id) {
      name
      stoptimesWithoutPatterns(numberOfDepartures: $n) {
        scheduledDeparture
        realtimeDeparture
        departureDelay
        realtime
        serviceDay
        headsign
        trip {
          route {
            shortName
            longName
            mode
          }
        }
      }
    }
  }
`;

export async function stopDeparturesOperation(
  client: GraphQLClient,
  args: { stopId: string; n: number },
  ctx: AdapterContext,
): Promise<RawStopDeparturesData> {
  return client.graphql<RawStopDeparturesData>(
    STOP_DEPARTURES_QUERY,
    { id: args.stopId, n: args.n },
    ctx,
  );
}
