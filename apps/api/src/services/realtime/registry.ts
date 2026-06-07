import type { RealtimeBus } from "./bus.js";
import { InMemoryBus, RedisPubSubBus } from "./bus.js";
import { config } from "../../config.js";
import type { Channel, ChannelKey, ChannelRegistry } from "./channels.js";
import { PollerPool, type Poller } from "./poller-pool.js";

/**
 * Channel factories supplied by `./channels/*.channel.ts` modules. Each
 * factory returns the upstream watcher for one key; the registry runs it
 * under refcount via the `PollerPool`.
 */
export type ChannelFactory = (key: ChannelKey, bus: RealtimeBus) => Poller;

const factories = new Map<"stop" | "line" | "alerts", ChannelFactory>();

/**
 * Register a factory for a channel-key prefix (`stop`, `line`, `alerts`).
 * Channel modules call this at import time; the registry dispatches by the
 * prefix segment of the key.
 */
export function registerChannelFactory(
  prefix: "stop" | "line" | "alerts",
  factory: ChannelFactory,
): void {
  factories.set(prefix, factory);
}

function prefixOf(key: ChannelKey): "stop" | "line" | "alerts" {
  const idx = key.indexOf(":");
  return key.slice(0, idx) as "stop" | "line" | "alerts";
}

class RegistryImpl implements ChannelRegistry {
  private readonly pool = new PollerPool();

  constructor(private readonly bus: RealtimeBus) {}

  get<T>(key: ChannelKey): Channel<T> {
    const factory = factories.get(prefixOf(key));
    if (!factory) {
      throw new Error(`No channel factory registered for "${key}"`);
    }
    const bus = this.bus;
    const pool = this.pool;
    return {
      key,
      subscribe(send: (event: T) => void): () => void {
        pool.acquire(key, () => factory(key, bus));
        const unsubFromBus = bus.subscribe(key, (e) => send(e as T));
        return () => {
          unsubFromBus();
          pool.release(key);
        };
      },
    };
  }

  /** Test introspection — current subscriber count for a key. */
  refCount(key: ChannelKey): number {
    return this.pool.refCount(key);
  }
}

/**
 * Build a fresh registry around a bus. Tests construct one per case; the
 * singleton at module scope (`registry`) is what production routes use.
 */
export function createRegistry(bus: RealtimeBus): RegistryImpl {
  return new RegistryImpl(bus);
}

function pickBus(): RealtimeBus {
  return config.realtimeBus === "redis-pubsub"
    ? new RedisPubSubBus()
    : new InMemoryBus();
}

/**
 * Process-wide registry. Routes consume this directly; tests build their own
 * via `createRegistry()` so cases stay isolated.
 */
export const registry = createRegistry(pickBus());
