import type { VehicleFilter, VehiclePosition } from "./types.js";

/**
 * Digitransit MQTT adapter contract. Chunk 1 lands the type + a no-op
 * implementation so consumers can type against it before Chunk 3 wires
 * the real WSS connection (`wss://mqtt.hsl.fi:443/`) and HFP decode.
 */
export interface DigitransitMqttAdapter {
  /**
   * Subscribe to vehicle pings matching `filter`. The returned function is
   * the unsubscribe handle — the registry calls it when the last SSE
   * connection on the line channel disconnects.
   */
  subscribeVehicles(
    filter: VehicleFilter,
    onMessage: (v: VehiclePosition) => void,
  ): () => void;
}

/**
 * Stub adapter — accepts subscriptions, never emits, returns a working
 * unsubscribe. Replaced by the real client in Chunk 3.
 */
export const digitransitMqtt: DigitransitMqttAdapter = {
  subscribeVehicles(_filter, _onMessage) {
    void _filter;
    void _onMessage;
    return () => {};
  },
};

export type { VehiclePosition, VehicleFilter } from "./types.js";
