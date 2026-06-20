import type { Alert } from "@reissulla/shared";
import { registerChannelFactory, type ChannelFactory } from "../registry.js";
import { getActive } from "../../alerts/alerts.service.js";
import { config } from "../../../config.js";

/**
 * Composed alerts channel. On the first subscriber for `alerts:<scope>` the
 * registry spawns this poller; it reads the cached active set every
 * `ALERTS_POLL_INTERVAL_SEC` and publishes the full `Alert[]` whenever the set
 * changes. Identical polls produce no event.
 *
 * The full (unfiltered) set is emitted — the FE filters by its own pins at the
 * edge, the same way it filters departures. `getActive` shares one cache slot
 * across every subscriber, so upstream is hit once per TTL regardless of how
 * many clients are connected.
 */

/** A signature that changes when any alert's identity or service impact does. */
function signature(alerts: Alert[]): string {
  return alerts
    .map((a) => `${a.id}:${a.severity}:${a.effect ?? ""}`)
    .sort()
    .join("|");
}

function startAlertsPoller(
  publish: (event: Alert[]) => void,
  controller: AbortController,
): void {
  let lastSignature: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async (): Promise<void> => {
    if (controller.signal.aborted) return;
    try {
      const { data } = await getActive();
      if (controller.signal.aborted) return;
      const sig = signature(data);
      if (sig !== lastSignature) {
        publish(data);
        lastSignature = sig;
      }
    } catch {
      // Upstream blip — skip this tick; the open SSE connection stays live and
      // the next tick retries.
    }
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      void tick();
    }, config.alertsPollIntervalSec * 1000);
  };

  controller.signal.addEventListener("abort", () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  });

  void tick();
}

const factory: ChannelFactory = (key, bus) => ({
  start: (controller) => {
    startAlertsPoller((event) => {
      void bus.publish(key, event);
    }, controller);
  },
});

registerChannelFactory("alerts", factory);

export {};
