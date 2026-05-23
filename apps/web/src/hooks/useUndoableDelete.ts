import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { showToast } from "../stores/toast";

export interface UndoableDeleteInput<TId> {
  /** Stable id of the item being removed. Used as the React key. */
  id: TId;
  /**
   * Toast message shown immediately on softDelete. Should describe
   * the action in past tense — "Saved location deleted".
   */
  message: string;
  /** Optional label override for the undo button (default "Undo"). */
  undoLabel?: string;
  /** Actually delete (the API call). Fires after the undo window. */
  commit: () => Promise<void> | void;
  /**
   * Optional handler fired when the user undoes. Most callers don't
   * need this — the soft-delete keeps the item visible via the
   * `pendingIds` filter, and pressing Undo just clears that filter.
   */
  onUndo?: () => void;
}

/**
 * Five-second undoable delete pattern. Call `softDelete()` and the
 * item's id is added to `pendingIds` (so the caller can filter it
 * out of the rendered list). A toast appears with an Undo button.
 * After 5 seconds with no Undo click, the toast auto-dismisses and
 * the `commit` function runs.
 *
 * Used by SavedLocationsManager (per-row delete), RecentPlacesList
 * (per-row delete and clear-all). For clear-all, pass an opaque
 * `id` (e.g. "ALL") since there's no specific row.
 */
export function useUndoableDelete<TId extends string>() {
  const [pendingIds, setPendingIds] = useState<Set<TId>>(new Set());
  const intl = useIntl();

  // Track commit handlers per id so we can call them precisely on
  // timeout. The ref survives re-renders without invalidating
  // anything that closes over it.
  const commitsRef = useRef(new Map<TId, () => Promise<void> | void>());

  const softDelete = useCallback(
    ({ id, message, undoLabel, commit, onUndo }: UndoableDeleteInput<TId>) => {
      setPendingIds((prev) => new Set(prev).add(id));
      commitsRef.current.set(id, commit);

      showToast({
        message,
        kind: "info",
        durationMs: 5000,
        action: {
          label: undoLabel ?? intl.formatMessage({ id: "undoableDelete.undo" }),
          onClick: () => {
            commitsRef.current.delete(id);
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            onUndo?.();
          },
        },
        onTimeout: () => {
          const commitFn = commitsRef.current.get(id);
          commitsRef.current.delete(id);
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          void commitFn?.();
        },
      });
    },
    [intl],
  );

  return { softDelete, pendingIds };
}
