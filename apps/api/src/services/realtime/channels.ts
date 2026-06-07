/**
 * Channel contracts for the SSE pipeline.
 *
 * A `Channel<T>` is the wire shape consuming subscribers see — typically a
 * single upstream watcher fans out to many SSE connections. The registry
 * (`./registry.ts`) refcounts subscribers and keeps exactly one underlying
 * poller alive per channel key; the bus (`./bus.ts`) is the in-process or
 * Redis-pubsub transport that carries events between the poller and the
 * route handler.
 *
 * Chunk 1 lands the contracts + stub channels that return empty streams.
 * Chunks 2–4 swap in real publish loops without touching this file.
 */

export type ChannelKey =
  | `stop:${string}`
  | `line:${string}`
  | `alerts:${string}`;

export interface Channel<T> {
  readonly key: ChannelKey;
  /**
   * Attach a listener. Returns an unsubscribe function — the registry calls
   * this when the last SSE connection on the key disconnects, which in turn
   * tears down the upstream poller.
   */
  subscribe(send: (event: T) => void): () => void;
}

export interface ChannelRegistry {
  /**
   * Resolves the singleton channel for `key`. Implementations spawn the
   * upstream poller on first subscribe and abort it on last unsubscribe.
   */
  get<T>(key: ChannelKey): Channel<T>;
}
