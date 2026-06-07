/**
 * Wire shape for a single vehicle ping from the Digitransit HFP / MQTT
 * stream. Matches docs/technical-plan.md §6.2.
 *
 * Coordinates are WGS-84 decimal degrees. `bearing` is heading in degrees
 * (0 = north, clockwise) — only present when the upstream feed exposes it.
 * `speed` is metres-per-second; absent when unknown. `delaySeconds` is
 * positive when running late, negative when early; nullable for vehicles
 * that haven't entered service yet.
 */
export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  /** GTFS direction id ("0" / "1") when the upstream exposes it. */
  directionId?: string;
  tripId?: string;
  lat: number;
  lon: number;
  bearing?: number;
  speed?: number;
  delaySeconds: number | null;
  /** Unix millis when the broker timestamped the message. */
  ts: number;
}

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
