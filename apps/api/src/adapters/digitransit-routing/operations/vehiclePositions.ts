import type { VehiclePosition } from "@reissulla/shared";
import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";

/**
 * Polled fallback for live vehicle positions when the HSL MQTT broker is
 * unreachable. OTP2 exposes the same GTFS-RT data through
 * `route(id).patterns.vehiclePositions`, refreshed on the upstream's own
 * clock — slower than MQTT but the same shape. The line-vehicles channel
 * drives this on a 5 s loop while degraded.
 */
export interface RawRouteVehiclePositionsData {
  route: {
    gtfsId: string;
    patterns:
      | {
          directionId: number | null;
          vehiclePositions:
            | {
                vehicleId: string | null;
                lat: number | null;
                lon: number | null;
                heading: number | null;
                speed: number | null;
                lastUpdated: number | null;
                trip: {
                  gtfsId: string | null;
                  directionId: number | null;
                } | null;
              }[]
            | null;
        }[]
      | null;
  } | null;
}

const QUERY = `
  query RouteVehiclePositions($id: String!) {
    route(id: $id) {
      gtfsId
      patterns {
        directionId
        vehiclePositions {
          vehicleId
          lat
          lon
          heading
          speed
          lastUpdated
          trip {
            gtfsId
            directionId
          }
        }
      }
    }
  }
`;

/**
 * Flatten the per-pattern vehicle lists into a single `VehiclePosition[]`.
 * Pure so the channel and tests can map a canned payload without a client.
 * `lastUpdated` is epoch seconds upstream; vehicles missing coordinates are
 * dropped rather than rendered at (0, 0).
 */
export function mapVehiclePositions(
  routeId: string,
  data: RawRouteVehiclePositionsData,
  now: number,
): VehiclePosition[] {
  const out: VehiclePosition[] = [];
  for (const pattern of data.route?.patterns ?? []) {
    for (const v of pattern.vehiclePositions ?? []) {
      if (v.vehicleId == null || v.lat == null || v.lon == null) continue;
      const dir = v.trip?.directionId ?? pattern.directionId;
      out.push({
        vehicleId: v.vehicleId,
        routeId,
        directionId: dir != null ? String(dir) : undefined,
        tripId: v.trip?.gtfsId ?? undefined,
        lat: v.lat,
        lon: v.lon,
        bearing: v.heading ?? undefined,
        speed: v.speed ?? undefined,
        delaySeconds: null,
        ts: v.lastUpdated != null ? v.lastUpdated * 1000 : now,
      });
    }
  }
  return out;
}

export async function vehiclePositionsOperation(
  client: GraphQLClient,
  routeId: string,
  ctx: AdapterContext,
): Promise<VehiclePosition[]> {
  const data = await client.graphql<RawRouteVehiclePositionsData>(
    QUERY,
    { id: routeId },
    ctx,
  );
  return mapVehiclePositions(routeId, data, Date.now());
}
