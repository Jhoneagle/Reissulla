import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "reissulla:dismissedWarnings:v1";

/**
 * Fallback TTL when an FMI warning has no `endTime` of its own. 24 h matches
 * the §14.2 spec — a still-active warning that lacks a published end gets
 * un-suppressed after a day so it doesn't disappear permanently.
 */
const FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

interface DismissedEntry {
  /** Unix ms at which the suppression should expire. */
  expiresAt: number;
}

type DismissedMap = Record<string, DismissedEntry>;

function readMap(): DismissedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as DismissedMap;
  } catch {
    return {};
  }
}

function writeMap(map: DismissedMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota / private mode — silent skip; the worst case is a
    // dismissed warning reappearing on next reload.
  }
}

function pruneExpired(map: DismissedMap, now: number): DismissedMap {
  const next: DismissedMap = {};
  let changed = false;
  for (const [id, entry] of Object.entries(map)) {
    if (entry.expiresAt > now) next[id] = entry;
    else changed = true;
  }
  return changed ? next : map;
}

/**
 * Per-warning dismissal store, persisted to localStorage. The dismissal
 * key is the warning `id`; the entry expires when the warning's own
 * `endTime` passes (per §14.2 — a still-active warning reappearing 24 h
 * after dismissal is annoying), falling back to a 24 h TTL when the
 * upstream omitted `endTime`.
 */
export function useDismissedWarnings(): {
  isDismissed: (id: string) => boolean;
  dismiss: (id: string, endTime: number | undefined) => void;
} {
  const [map, setMap] = useState<DismissedMap>(() => {
    const initial = readMap();
    return pruneExpired(initial, Date.now());
  });

  useEffect(() => {
    writeMap(map);
  }, [map]);

  const isDismissed = useCallback(
    (id: string): boolean => {
      const entry = map[id];
      if (!entry) return false;
      return entry.expiresAt > Date.now();
    },
    [map],
  );

  const dismiss = useCallback(
    (id: string, endTime: number | undefined): void => {
      const now = Date.now();
      const expiresAt =
        endTime !== undefined && endTime > now
          ? endTime
          : now + FALLBACK_TTL_MS;
      setMap((prev) => ({ ...prev, [id]: { expiresAt } }));
    },
    [],
  );

  return { isDismissed, dismiss };
}
