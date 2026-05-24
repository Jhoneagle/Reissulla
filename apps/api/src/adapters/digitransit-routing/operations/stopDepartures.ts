import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawStopDeparturesData } from "../types.js";

export interface StopDeparturesArgs {
  stopId: string;
  numberOfDepartures: number;
  /** Unix seconds; defaults to now upstream-side. */
  startTime?: number;
  /**
   * When true, only stoptimes that allow boarding return — i.e. exclude
   * trips where this stop is a drop-off / terminus. OTP2's GTFS schema
   * does not expose a distinct ARRIVALS toggle on
   * `stoptimesWithoutPatterns`, so the FE arrivals-vs-departures choice
   * maps onto this single switch: true = departures only, false = both.
   */
  omitNonPickups?: boolean;
  omitCanceled?: boolean;
  /** Lookahead window in seconds; defaults to 12 h upstream. */
  timeRange?: number;
}

function buildQuery(args: StopDeparturesArgs): string {
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
    query StopDepartures($id: String!) {
      stop(id: $id) {
        name
        stoptimesWithoutPatterns(${parts.join(", ")}) {
          scheduledArrival
          realtimeArrival
          arrivalDelay
          scheduledDeparture
          realtimeDeparture
          departureDelay
          realtime
          serviceDay
          headsign
          pickupType
          dropoffType
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

export async function stopDeparturesOperation(
  client: GraphQLClient,
  args: StopDeparturesArgs,
  ctx: AdapterContext,
): Promise<RawStopDeparturesData> {
  return client.graphql<RawStopDeparturesData>(
    buildQuery(args),
    { id: args.stopId },
    ctx,
  );
}
