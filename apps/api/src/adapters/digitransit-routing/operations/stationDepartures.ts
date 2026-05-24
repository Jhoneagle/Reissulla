import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawStationDeparturesData } from "../types.js";

export interface StationDeparturesArgs {
  stationId: string;
  numberOfDepartures: number;
  startTime?: number;
  /** See StopDeparturesArgs — same semantics. */
  omitNonPickups?: boolean;
  omitCanceled?: boolean;
  timeRange?: number;
}

function buildQuery(args: StationDeparturesArgs): string {
  const parts: string[] = [`numberOfDepartures: ${args.numberOfDepartures}`];
  if (args.startTime !== undefined) parts.push(`startTime: ${args.startTime}`);
  if (args.omitNonPickups !== undefined) {
    parts.push(`omitNonPickups: ${args.omitNonPickups}`);
  }
  if (args.omitCanceled !== undefined) {
    parts.push(`omitCanceled: ${args.omitCanceled}`);
  }
  if (args.timeRange !== undefined) parts.push(`timeRange: ${args.timeRange}`);
  return `
    query StationDepartures($id: String!) {
      station(id: $id) {
        name
        stoptimesWithoutPatterns(${parts.join(", ")}) {
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
            gtfsId
            wheelchairAccessible
            route {
              gtfsId
              shortName
              longName
              mode
            }
          }
        }
      }
    }
  `;
}

export async function stationDeparturesOperation(
  client: GraphQLClient,
  args: StationDeparturesArgs,
  ctx: AdapterContext,
): Promise<RawStationDeparturesData> {
  return client.graphql<RawStationDeparturesData>(
    buildQuery(args),
    { id: args.stationId },
    ctx,
  );
}
