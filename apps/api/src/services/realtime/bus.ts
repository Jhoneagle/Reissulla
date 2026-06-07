import { EventEmitter } from "node:events";
import type { ChannelKey } from "./channels.js";

/**
 * Pub/sub transport for realtime events. `InMemoryBus` is the single-instance
 * default; `RedisPubSubBus` wraps the existing `cache/redis.ts` client so a
 * second API node ships as a config flip (`REALTIME_BUS=redis-pubsub`) — see
 * docs/architecture.md §10.2.
 */
export interface RealtimeBus {
  publish(key: ChannelKey, event: unknown): Promise<void>;
  subscribe(key: ChannelKey, handler: (event: unknown) => void): () => void;
}

/**
 * Default bus — a wrapped `EventEmitter`. The emitter is unbounded by default
 * which is correct: every SSE connection on a hot stop becomes one listener,
 * and the registry guarantees that when the connection closes the listener
 * is removed.
 */
export class InMemoryBus implements RealtimeBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // A single high-traffic stop with many tabs open across one office WiFi
    // can easily exceed the default 10-listener warning threshold. Disable
    // the cap — the registry's refcounted teardown is the real bound.
    this.emitter.setMaxListeners(0);
  }

  async publish(key: ChannelKey, event: unknown): Promise<void> {
    this.emitter.emit(key, event);
  }

  subscribe(key: ChannelKey, handler: (event: unknown) => void): () => void {
    this.emitter.on(key, handler);
    return () => {
      this.emitter.off(key, handler);
    };
  }
}

/**
 * Redis pub/sub bus stub. Chunk 1 lands the contract; the actual ioredis
 * subscriber/publisher pair wires in when a second API instance is provisioned
 * (today's Hetzner CX22 runs one). Calling it raises so a mis-set
 * `REALTIME_BUS=redis-pubsub` fails loudly during boot rather than silently
 * dropping events.
 */
export class RedisPubSubBus implements RealtimeBus {
  async publish(): Promise<void> {
    throw new Error(
      "RedisPubSubBus is not yet implemented; set REALTIME_BUS=memory",
    );
  }

  subscribe(): () => void {
    throw new Error(
      "RedisPubSubBus is not yet implemented; set REALTIME_BUS=memory",
    );
  }
}
