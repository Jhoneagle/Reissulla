import { registerChannelFactory, type ChannelFactory } from "../registry.js";

/**
 * Per-stop live-departures channel. Chunk 1 is a deliberate stub — the
 * registry will call into this factory, but the supplied poller is a no-op
 * so the SSE plumbing can land + be tested in isolation. Chunk 2 swaps the
 * stub for a 5 s shared poller that diffs against the last publish and
 * emits only changed rows.
 */
const factory: ChannelFactory = () => ({
  start: () => {
    // No upstream subscription yet — Chunk 2 wires getStopDepartures().
  },
});

registerChannelFactory("stop", factory);

export {};
