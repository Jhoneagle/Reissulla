import type { TransitDeparture } from "@reissulla/shared";
import { registerChannelFactory, type ChannelFactory } from "../registry.js";
import { getStopDepartures } from "../../transit/departures.service.js";
import { diffDepartures } from "./stop-departures-diff.js";
import { config } from "../../../config.js";

/**
 * Per-stop live-departures channel. On the first subscriber for
 * `stop:<gtfsId>` the registry spawns this poller; it calls
 * `getStopDepartures()` every 5 s and publishes the new
 * `TransitDeparture[]` whenever the diff against the last publish is
 * non-empty (any realtime/delay change, plus new trips). Unchanged
 * polls produce no event — saves bandwidth on rural stops.
 *
 * The poller goes through the same resilient cache path as the REST
 * endpoint; transient upstream failures surface as no-op polls rather
 * than torn-down channels.
 */
function startStopDeparturesPoller(
  gtfsId: string,
  publish: (event: TransitDeparture[]) => void,
  controller: AbortController,
): void {
  let lastPublished: TransitDeparture[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async (): Promise<void> => {
    if (controller.signal.aborted) return;
    try {
      const { data } = await getStopDepartures(gtfsId, 20, false);
      if (controller.signal.aborted) return;
      const next = data.departures;
      const changed = diffDepartures(lastPublished, next);
      if (changed.length > 0) {
        publish(next);
        lastPublished = next;
      }
    } catch {
      // Upstream blip — skip this tick. The next tick will retry; the
      // FE's `<LiveIndicator>` stays "live" because the SSE connection
      // is still open and the cache TTL keeps recent data on the wire.
    }
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      void tick();
    }, config.realtimeStopPollMs);
  };

  controller.signal.addEventListener("abort", () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  });

  void tick();
}

const factory: ChannelFactory = (key, bus) => {
  const gtfsId = key.slice("stop:".length);
  return {
    start: (controller) => {
      startStopDeparturesPoller(
        gtfsId,
        (event) => {
          void bus.publish(key, event);
        },
        controller,
      );
    },
  };
};

registerChannelFactory("stop", factory);

export {};
