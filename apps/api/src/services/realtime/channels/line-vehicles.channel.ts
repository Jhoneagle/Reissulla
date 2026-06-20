import type { LineVehiclesEvent, VehiclePosition } from "@reissulla/shared";
import { registerChannelFactory, type ChannelFactory } from "../registry.js";
import {
  digitransitMqtt,
  type DigitransitMqttAdapter,
} from "../../../adapters/digitransit-mqtt/index.js";
import { cacheGet, cacheSet } from "../../../cache/cache.js";
import { cacheKey } from "../../../cache/key.js";
import { LIVE_VEHICLE_TTL } from "../../../cache/ttl.js";
import { redis } from "../../../cache/redis.js";
import { config } from "../../../config.js";

/**
 * Per-line live-vehicle channel. On the first subscriber for `line:<gtfsId>`
 * the registry starts this poller; it opens an MQTT subscription via the
 * Digitransit adapter and accumulates pings into an in-memory set keyed by
 * vehicle id. The full set publishes on a coalesce clock
 * (`realtimeVehiclePublishMs`) as a `LineVehiclesEvent` snapshot — so a
 * client connecting mid-stream renders every dot on its first event rather
 * than waiting to accumulate. Vehicles unseen past `realtimeVehicleStaleMs`
 * are pruned so dots for departed vehicles disappear.
 *
 * Each published vehicle is mirrored into the sliding
 * `live:vehicle:v1:<gtfsId>:<vehicleId>` cache so a fresh channel (after the
 * last subscriber left and the poller was torn down) can prime its first
 * snapshot from cache before the next ping arrives.
 */

function vehicleCacheKey(gtfsId: string, vehicleId: string): string {
  return cacheKey("live", "vehicle", 1, gtfsId, vehicleId);
}

/** Read back the sliding cache for a line so a fresh channel starts warm. */
async function primeFromCache(gtfsId: string): Promise<VehiclePosition[]> {
  const pattern = `${cacheKey("live", "vehicle", 1, gtfsId)}:*`;
  const keys: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = redis.scanStream({ match: pattern, count: 100 });
    stream.on("data", (batch: string[]) => keys.push(...batch));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  if (keys.length === 0) return [];
  const values = await Promise.all(
    keys.map((k) => cacheGet<VehiclePosition>(k)),
  );
  return values.filter((v): v is VehiclePosition => v !== null);
}

export interface LineVehiclesDeps {
  adapter?: DigitransitMqttAdapter;
  cacheWrite?: (gtfsId: string, v: VehiclePosition) => void;
  cachePrime?: (gtfsId: string) => Promise<VehiclePosition[]>;
  now?: () => number;
}

export function startLineVehiclesPoller(
  gtfsId: string,
  publish: (event: LineVehiclesEvent) => void,
  controller: AbortController,
  deps: LineVehiclesDeps = {},
): void {
  const adapter = deps.adapter ?? digitransitMqtt;
  const now = deps.now ?? Date.now;
  const cacheWrite =
    deps.cacheWrite ??
    ((id, v) => {
      void cacheSet(vehicleCacheKey(id, v.vehicleId), v, LIVE_VEHICLE_TTL);
    });
  const cachePrime = deps.cachePrime ?? primeFromCache;

  const vehicles = new Map<string, VehiclePosition>();
  let degraded = false;
  let lastPublishedCount = 0;
  let lastDegraded = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let unsub: (() => void) | null = null;

  const prune = (): void => {
    const cutoff = now() - config.realtimeVehicleStaleMs;
    for (const [id, v] of vehicles) {
      if (v.ts < cutoff) vehicles.delete(id);
    }
  };

  const publishSnapshot = (): void => {
    if (controller.signal.aborted) return;
    prune();
    const list = [...vehicles.values()];
    // Skip a pure no-op: empty now, empty last time, and degraded unchanged.
    if (
      list.length === 0 &&
      lastPublishedCount === 0 &&
      degraded === lastDegraded
    ) {
      return;
    }
    for (const v of list) cacheWrite(gtfsId, v);
    publish({ vehicles: list, freshness: { degraded } });
    lastPublishedCount = list.length;
    lastDegraded = degraded;
  };

  // Warm the set from the sliding cache so the first snapshot has dots.
  void cachePrime(gtfsId).then((primed) => {
    if (controller.signal.aborted) return;
    for (const v of primed) vehicles.set(v.vehicleId, v);
  });

  unsub = adapter.subscribeVehicles(
    { route: gtfsId },
    (v) => {
      vehicles.set(v.vehicleId, v);
    },
    (status) => {
      degraded = status.degraded;
    },
  );

  timer = setInterval(publishSnapshot, config.realtimeVehiclePublishMs);

  controller.signal.addEventListener("abort", () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (unsub) {
      unsub();
      unsub = null;
    }
  });
}

const factory: ChannelFactory = (key, bus) => {
  const gtfsId = key.slice("line:".length);
  return {
    start: (controller) => {
      startLineVehiclesPoller(
        gtfsId,
        (event) => {
          void bus.publish(key, event);
        },
        controller,
      );
    },
  };
};

registerChannelFactory("line", factory);
