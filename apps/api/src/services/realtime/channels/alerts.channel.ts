import { registerChannelFactory, type ChannelFactory } from "../registry.js";

/**
 * Composed alerts channel (Digitransit `alerts(...)` + FMI warnings +
 * Fintraffic incidents merged into the unified `Alert` shape). Stub in
 * Chunk 1; Chunk 4 wires `alerts.service.streamActive()` which emits a
 * delta event when the active-alert set changes.
 */
const factory: ChannelFactory = () => ({
  start: () => {
    // No source polling yet — Chunk 4 wires alerts.service.
  },
});

registerChannelFactory("alerts", factory);

export {};
