import type { ChannelKey } from "./channels.js";

/**
 * A `Poller` is the upstream watcher behind one channel key — e.g. the 5 s
 * Digitransit `stoptimesForStop` call for a `stop:<gtfsId>` channel.
 *
 * The pool is refcounted: the first subscriber for a key calls `acquire()`
 * which calls `start(controller)`; the last subscriber's release aborts the
 * controller. Channel implementations supply the `start` function; the pool
 * owns lifecycle.
 */
export interface Poller {
  start: (controller: AbortController) => void | Promise<void>;
}

interface Entry {
  refCount: number;
  controller: AbortController;
}

export class PollerPool {
  private readonly entries = new Map<ChannelKey, Entry>();

  /**
   * Increment the refcount for `key`. If this is the first acquirer, call
   * `factory()` to obtain the upstream watcher and start it.
   */
  acquire(key: ChannelKey, factory: () => Poller): void {
    const existing = this.entries.get(key);
    if (existing) {
      existing.refCount += 1;
      return;
    }
    const controller = new AbortController();
    const poller = factory();
    this.entries.set(key, { refCount: 1, controller });
    void poller.start(controller);
  }

  /**
   * Decrement the refcount for `key`. When it reaches zero, abort the
   * underlying controller and drop the entry. No-op for unknown keys so a
   * stray release after teardown doesn't throw.
   */
  release(key: ChannelKey): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.controller.abort();
      this.entries.delete(key);
    }
  }

  /** Test introspection — current refcount for a key (0 if absent). */
  refCount(key: ChannelKey): number {
    return this.entries.get(key)?.refCount ?? 0;
  }
}
