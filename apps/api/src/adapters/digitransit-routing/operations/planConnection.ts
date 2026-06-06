import { personaToPlanArgs } from "@reissulla/shared";
import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type {
  PlanConnectionArgs,
  PlanConnectionMode,
  RawPlanConnectionData,
} from "../types.js";

// OTP2 uses a custom `CoordinateValue` scalar — coordinates must be inlined
// in the query rather than passed as Float variables.

const ALL_TRANSIT_MODES: PlanConnectionMode[] = [
  "BUS",
  "RAIL",
  "TRAM",
  "SUBWAY",
  "FERRY",
];

function buildModesBlock(args: PlanConnectionArgs): string {
  const transitModes =
    args.transitModes && args.transitModes.length > 0
      ? args.transitModes.filter((m) => m !== "BICYCLE")
      : ALL_TRANSIT_MODES;
  const transitList = transitModes.map((m) => `{ mode: ${m} }`).join(", ");
  const directList = args.transitModes?.includes("BICYCLE")
    ? "[WALK, BICYCLE]"
    : "[WALK]";
  return `modes: {
        direct: ${directList}
        transit: { transit: [${transitList}] }
      }`;
}

function buildPreferencesBlock(
  args: PlanConnectionArgs,
  ctx: AdapterContext,
): string {
  const personaArgs = ctx.persona ? personaToPlanArgs(ctx.persona) : {};
  const accessibilityParts: string[] = [];
  if (personaArgs.wheelchair) {
    accessibilityParts.push("wheelchair: { enabled: true }");
  }
  const walkingParts: string[] = [];
  if (typeof args.walkSpeedMetresPerSec === "number") {
    walkingParts.push(`speed: ${args.walkSpeedMetresPerSec.toFixed(2)}`);
  }
  if (args.walkReluctanceBoost) {
    // OTP2 weights walking higher when reluctance > 1 — TRIP-5 "least-walking"
    // and TRIP-13 "avoid stairs" both nudge this. 4.0 picks shorter walks even
    // at the cost of more transit weight; 2.0 is OTP2's default.
    walkingParts.push("reluctance: 4.0");
  }
  const transferParts: string[] = [];
  if (typeof args.numberOfTransfers === "number") {
    transferParts.push(`maximumTransfers: ${args.numberOfTransfers}`);
  }
  const street: string[] = [];
  if (walkingParts.length > 0) {
    street.push(`walk: { ${walkingParts.join(" ")} }`);
  }
  const accessibility =
    accessibilityParts.length > 0
      ? `accessibility: { ${accessibilityParts.join(" ")} }`
      : "";
  const transfer =
    transferParts.length > 0 ? `transfer: { ${transferParts.join(" ")} }` : "";
  const inner: string[] = [];
  if (accessibility) inner.push(accessibility);
  if (street.length > 0) inner.push(`street: { ${street.join(" ")} }`);
  if (transfer) inner.push(transfer);
  if (inner.length === 0) return "";
  return `preferences: { ${inner.join(" ")} }`;
}

function buildDateTimeBlock(args: PlanConnectionArgs): string {
  if (typeof args.dateTime !== "number") return "";
  const iso = new Date(args.dateTime * 1000).toISOString();
  if (args.arriveBy) {
    return `dateTime: { latestArrival: "${iso}" }`;
  }
  return `dateTime: { earliestDeparture: "${iso}" }`;
}

function buildPlanQuery(args: PlanConnectionArgs, ctx: AdapterContext): string {
  const modes = buildModesBlock(args);
  const preferences = buildPreferencesBlock(args, ctx);
  const dateTime = buildDateTimeBlock(args);

  return `query PlanConnection {
    planConnection(
      origin: { location: { coordinate: { latitude: ${args.fromLat}, longitude: ${args.fromLon} } } }
      destination: { location: { coordinate: { latitude: ${args.toLat}, longitude: ${args.toLon} } } }
      first: ${args.numItineraries}
      ${dateTime}
      ${modes}
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
            route {
              shortName
              longName
              agency { gtfsId name }
            }
            intermediateStops { name gtfsId }
            steps { distance relativeDirection streetName }
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
