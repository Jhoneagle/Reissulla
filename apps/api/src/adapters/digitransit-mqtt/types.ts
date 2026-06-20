import type { VehiclePosition } from "@reissulla/shared";

/**
 * The vehicle-ping wire shape lives in `@reissulla/shared` so the SSE
 * publisher and the web overlay share one contract. Re-exported here so
 * adapter consumers keep importing it from the adapter barrel.
 */
export type { VehiclePosition } from "@reissulla/shared";

export interface VehicleFilter {
  /** GTFS route id (e.g. "HSL:1014") — narrows the topic subscription. */
  route?: string;
  /**
   * Region code for adapter routing. Phase 4 only consumes HSL, but the
   * field is already in the contract so future Waltti / VäRELY brokers
   * slot in without an API break.
   */
  region?: "hsl" | "waltti" | "varely";
}

/**
 * Health signal raised alongside vehicle pings. `degraded` flips true when
 * the adapter has fallen back to the polled `vehiclePositions` GraphQL query
 * after the MQTT broker stayed unreachable past the fallback threshold, and
 * back to false once the broker reconnects.
 */
export interface VehicleStreamStatus {
  degraded: boolean;
}

/** Local alias kept so call sites can read the decode return shape. */
export type DecodedVehicle = VehiclePosition;
