import { personaToPlanArgs } from "@reissulla/shared";
import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { PlanConnectionArgs, RawPlanConnectionData } from "../types.js";

// OTP2 uses a custom `CoordinateValue` scalar — coordinates must be inlined
// in the query rather than passed as Float variables.
function buildPlanQuery(args: PlanConnectionArgs, ctx: AdapterContext): string {
  const personaArgs = ctx.persona ? personaToPlanArgs(ctx.persona) : {};
  const preferences = personaArgs.wheelchair
    ? `preferences: { accessibility: { wheelchair: { enabled: true } } }`
    : "";

  return `{
    planConnection(
      origin: { location: { coordinate: { latitude: ${args.fromLat}, longitude: ${args.fromLon} } } }
      destination: { location: { coordinate: { latitude: ${args.toLat}, longitude: ${args.toLon} } } }
      first: ${args.numItineraries}
      modes: {
        direct: [WALK]
        transit: { transit: [{ mode: BUS }, { mode: RAIL }, { mode: TRAM }, { mode: SUBWAY }, { mode: FERRY }] }
      }
      ${preferences}
    ) {
      edges {
        node {
          startTime
          endTime
          numberOfTransfers
          walkDistance
          legs {
            mode
            startTime
            endTime
            duration
            distance
            from {
              name
              lat
              lon
              stop { gtfsId code }
            }
            to {
              name
              lat
              lon
              stop { gtfsId code }
            }
            route { shortName longName }
            intermediateStops { name gtfsId }
          }
        }
      }
    }
  }`;
}

export async function planConnectionOperation(
  client: GraphQLClient,
  args: PlanConnectionArgs,
  ctx: AdapterContext,
): Promise<RawPlanConnectionData> {
  return client.graphql<RawPlanConnectionData>(
    buildPlanQuery(args, ctx),
    {},
    ctx,
  );
}
