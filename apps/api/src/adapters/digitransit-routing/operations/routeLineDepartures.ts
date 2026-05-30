import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type {
  RawRouteLineDeparturesData,
  RawRouteLineDeparturesRoute,
} from "../types.js";

// Per-stop next-departures for every stop on every pattern of a route, in
// one round-trip. Replaces the per-stop fan-out the LineView previously
// drove via `getStopDepartures`. Returns up to `numberOfDepartures`
// stoptimes per pattern at each stop; the consumer filters down to the
// target pattern's stoptimes when projecting `LineStopDeparture[]`.
const ROUTE_LINE_DEPARTURES_QUERY = `
  query RouteLineDepartures($routeId: String!, $startTime: Long!, $numberOfDepartures: Int!) {
    route(id: $routeId) {
      patterns {
        code
        directionId
        stops {
          gtfsId
          stoptimesForPatterns(
            numberOfDepartures: $numberOfDepartures
            startTime: $startTime
            timeRange: 86400
            omitCanceled: true
            omitNonPickups: true
          ) {
            pattern { code }
            stoptimes {
              scheduledDeparture
              realtimeDeparture
              departureDelay
              realtime
              serviceDay
              trip { gtfsId }
            }
          }
        }
      }
    }
  }
`;

export interface RouteLineDeparturesArgs {
  routeId: string;
  /** Unix seconds; stoptimes earlier than this are excluded upstream. */
  startTime: number;
  /** Max stoptimes per pattern at each stop. 3 suffices for headway math. */
  numberOfDepartures: number;
}

export async function routeLineDeparturesOperation(
  client: GraphQLClient,
  args: RouteLineDeparturesArgs,
  ctx: AdapterContext,
): Promise<RawRouteLineDeparturesRoute | null> {
  const raw = await client.graphql<RawRouteLineDeparturesData>(
    ROUTE_LINE_DEPARTURES_QUERY,
    {
      routeId: args.routeId,
      startTime: args.startTime,
      numberOfDepartures: args.numberOfDepartures,
    },
    ctx,
  );
  return raw.route;
}
