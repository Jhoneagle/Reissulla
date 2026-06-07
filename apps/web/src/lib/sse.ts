import { useEffect, useRef, useState } from "react";

export type SseStatus = "connecting" | "open" | "closed" | "error";

export interface SseSubscription<T> {
  data: T | null;
  status: SseStatus;
  /** Wall-clock ms (`Date.now()`) of the most recent event, or null before. */
  lastUpdate: number | null;
}

export interface SseSubscriptionOptions {
  /**
   * When true (default), the EventSource closes while the tab is hidden and
   * reconnects when it returns to visible — matches the architecture.md §10.4
   * rule that a parked tab shouldn't hold a server fanout slot.
   */
  pauseOnHidden?: boolean;
  /**
   * Lets a caller short-circuit the hook without changing the path (e.g.
   * feature-flag off). Defaults to true. Path === null also disables.
   */
  enabled?: boolean;
}

/**
 * Maximum backoff between reconnect attempts. The formula is
 * `min(2 ** attempt, MAX) * 1000` ms — 1 s, 2 s, 4 s, 8 s, 16 s, 30 s cap.
 * Reset to attempt 0 on any successful event.
 */
const MAX_BACKOFF_S = 30;

function computeBackoffMs(attempt: number): number {
  return Math.min(2 ** attempt, MAX_BACKOFF_S) * 1000;
}

interface InternalState<T> {
  data: T | null;
  connectionPhase: SseStatus;
  lastUpdate: number | null;
}

/**
 * Subscribe to a server-sent events stream of JSON-encoded payloads of
 * shape `T`. Returns the latest decoded event plus the connection status.
 *
 * Reconnects exponentially on error (1 s → 2 s → 4 s → … → 30 s cap),
 * resets the backoff on any received event, and (by default) pauses the
 * connection while the tab is hidden so an idle background tab doesn't
 * waste a server fanout slot. Set `pauseOnHidden: false` for surfaces
 * that must keep collecting events while parked (announcers etc.).
 *
 * The disabled state (`enabled === false` or `path === null`) is derived
 * outside of the effect so the hook never has to setState synchronously
 * during render — only EventSource callbacks and timers mutate state.
 */
export function useSseSubscription<T>(
  path: string | null,
  opts?: SseSubscriptionOptions,
): SseSubscription<T> {
  const pauseOnHidden = opts?.pauseOnHidden ?? true;
  const enabled = opts?.enabled ?? true;

  const [internal, setInternal] = useState<InternalState<T>>({
    data: null,
    connectionPhase: "connecting",
    lastUpdate: null,
  });

  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!enabled || !path) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    let cancelled = false;

    const clearReconnectTimer = (): void => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSource = (): void => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };

    const connect = (): void => {
      if (cancelled) return;
      closeSource();
      setInternal((s) => ({ ...s, connectionPhase: "connecting" }));
      const src = new EventSource(path);
      sourceRef.current = src;

      src.onopen = (): void => {
        if (cancelled) return;
        setInternal((s) => ({ ...s, connectionPhase: "open" }));
      };

      src.onmessage = (event: MessageEvent<string>): void => {
        if (cancelled) return;
        attemptRef.current = 0;
        try {
          const parsed = JSON.parse(event.data) as T;
          setInternal({
            data: parsed,
            connectionPhase: "open",
            lastUpdate: Date.now(),
          });
        } catch {
          // Non-JSON keep-alive comments arrive as plain ":" lines and the
          // browser's EventSource skips them automatically — anything that
          // reaches onmessage with a non-JSON body is a server bug we'd
          // rather log than crash on.
        }
      };

      src.onerror = (): void => {
        if (cancelled) return;
        closeSource();
        setInternal((s) => ({ ...s, connectionPhase: "error" }));
        const delay = computeBackoffMs(attemptRef.current);
        attemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      };
    };

    const handleVisibilityChange = (): void => {
      if (!pauseOnHidden) return;
      if (document.visibilityState === "hidden") {
        clearReconnectTimer();
        closeSource();
        setInternal((s) => ({ ...s, connectionPhase: "closed" }));
      } else if (document.visibilityState === "visible") {
        attemptRef.current = 0;
        connect();
      }
    };

    // Schedule the initial connect (or the initial "closed" transition when
    // mounting in a hidden tab) through a timer so the effect body stays free
    // of synchronous setState calls. EventSource lifecycle then drives every
    // subsequent state mutation through its own async callbacks.
    const startHidden = pauseOnHidden && document.visibilityState === "hidden";
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (startHidden) {
        setInternal((s) => ({ ...s, connectionPhase: "closed" }));
      } else {
        connect();
      }
    }, 0);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearReconnectTimer();
      closeSource();
    };
  }, [path, enabled, pauseOnHidden]);

  const status: SseStatus =
    !enabled || !path ? "closed" : internal.connectionPhase;

  return {
    data: internal.data,
    status,
    lastUpdate: internal.lastUpdate,
  };
}
