/**
 * DEP-13 vehicle-approach announcer (timing core).
 *
 * Pure scheduling logic — no DOM, no intl — so the throttle + coalesce
 * behaviour is unit-testable with an injected clock. The React provider
 * (LiveAnnouncerProvider) supplies the `emit` sink that turns a coalesced
 * batch into a localised string and writes it to the polite live region.
 *
 * Two rules, per stop:
 *  - **15 s floor.** After a batch is emitted for a stopId, further
 *    announcements for that stop are dropped until `minIntervalMs` elapses, so
 *    a busy stop can't fire an interruption every few seconds.
 *  - **Coalesce window.** The first announcement for a quiet stop opens a
 *    `coalesceMs` window; announcements landing inside it are merged into one
 *    batch (deduped by route), so "Line 14" + "Line 9" arriving together emit
 *    as a single combined message instead of two.
 */

export interface ApproachPayload {
  stopId: string;
  stopName: string;
  routeShortName: string;
  headsign: string;
  /** Seconds until the vehicle's realtime departure (clamped ≥ 0 by caller). */
  etaSeconds: number;
}

export interface LiveAnnouncerOptions {
  /** Sink for a coalesced batch (all the same stopId). */
  emit: (batch: ApproachPayload[]) => void;
  /** Per-stop rate-limit floor. Default 15 000 ms. */
  minIntervalMs?: number;
  /** Coalesce window. Default 2000 ms; the provider maps reading pace to it. */
  coalesceMs?: number;
  // Injectable timers so tests drive the clock deterministically.
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

export interface LiveAnnouncer {
  announce: (payload: ApproachPayload) => void;
  dispose: () => void;
}

interface StopState {
  lastEmitAt: number;
  batch: ApproachPayload[] | null;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createLiveAnnouncer(opts: LiveAnnouncerOptions): LiveAnnouncer {
  const minIntervalMs = opts.minIntervalMs ?? 15_000;
  const coalesceMs = opts.coalesceMs ?? 2000;
  const now = opts.now ?? (() => Date.now());
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h));

  const stops = new Map<string, StopState>();

  function flush(stopId: string): void {
    const state = stops.get(stopId);
    if (!state || state.batch === null) return;
    const batch = state.batch;
    state.batch = null;
    state.timer = null;
    state.lastEmitAt = now();
    opts.emit(batch);
  }

  function announce(payload: ApproachPayload): void {
    const stopId = payload.stopId;
    const state: StopState = stops.get(stopId) ?? {
      lastEmitAt: Number.NEGATIVE_INFINITY,
      batch: null,
      timer: null,
    };
    stops.set(stopId, state);

    // Coalesce window open → merge into the pending batch (dedupe by route;
    // the later, fresher payload wins so the ETA stays current).
    if (state.batch !== null) {
      state.batch = [
        ...state.batch.filter(
          (p) => p.routeShortName !== payload.routeShortName,
        ),
        payload,
      ];
      return;
    }

    // 15 s floor — within the cooldown of the last emit, drop silently.
    if (now() - state.lastEmitAt < minIntervalMs) return;

    state.batch = [payload];
    state.timer = setTimer(() => flush(stopId), coalesceMs);
  }

  function dispose(): void {
    for (const state of stops.values()) {
      if (state.timer !== null) clearTimer(state.timer);
    }
    stops.clear();
  }

  return { announce, dispose };
}
