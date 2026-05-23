import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawStationDeparturesData } from "../types.js";

const STATION_DEPARTURES_QUERY = `
  query StationDepartures($id: String!, $n: Int!) {
    station(id: $id) {
      name
      stoptimesWithoutPatterns(numberOfDepartures: $n) {
        scheduledDeparture
        realtimeDeparture
        departureDelay
        realtime
        serviceDay
        headsign
        stop {
          gtfsId
          platformCode
          code
        }
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

export async function stationDeparturesOperation(
  client: GraphQLClient,
  args: { stationId: string; n: number },
  ctx: AdapterContext,
): Promise<RawStationDeparturesData> {
  return client.graphql<RawStationDeparturesData>(
    STATION_DEPARTURES_QUERY,
    { id: args.stationId, n: args.n },
    ctx,
  );
}
