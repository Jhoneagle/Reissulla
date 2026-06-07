import { registerChannelFactory, type ChannelFactory } from "../registry.js";

/**
 * Per-line live-vehicle channel. Stub in Chunk 1; Chunk 3 connects this
 * factory to the Digitransit MQTT adapter (`subscribeVehicles({ route })`)
 * and writes the sliding `live:vehicle:v1:<routeId>:<vehicleId>` cache so
 * a reconnecting client gets the freshest dot immediately.
 */
const factory: ChannelFactory = () => ({
  start: () => {
    // No MQTT subscription yet — Chunk 3 wires DigitransitMqttAdapter.
  },
});

registerChannelFactory("line", factory);

export {};
