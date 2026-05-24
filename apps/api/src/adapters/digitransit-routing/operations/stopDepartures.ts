import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawStopDeparturesData } from "../types.js";

export interface StopDeparturesArgs {
  stopId: string;
  numberOfDepartures: number;
  /** Unix seconds; defaults to now upstream-side. */
  startTime?: number;
  /** OTP2 enum — DEPARTURES (default), ARRIVALS, BOTH. */
  arrivalDeparture?: "DEPARTURES" | "ARRIVALS" | "BOTH";
  omitCanceled?: boolean;
  /** Lookahead window in seconds; defaults to 12 h upstream. */
  timeRange?: number;
}

// arrivalDeparture is an enum literal that must inline; the rest can be
// vars but inlining everything keeps the query string self-contained and
// avoids one variable signature per option permutation.
function buildQuery(args: StopDeparturesArgs): string {
  const parts: string[] = [`numberOfDepartures: ${args.numberOfDepartures}`];
  if (args.startTime !== undefined) parts.push(`startTime: ${args.startTime}`);
  if (args.arrivalDeparture) {
    parts.push(`arrivalDeparture: ${args.arrivalDeparture}`);
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
