import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

interface ToastInput {
  message: string;
  kind?: ToastKind;
  /** Optional inline action button (e.g. an undo affordance). */
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Default 3000; 5000 is the W3.5 undo window. */
  durationMs?: number;
  /** Callback fired when the toast auto-dismisses (NOT when the user
   *  presses the action or dismisses manually). Used by useUndoableDelete
   *  to commit the deletion once the undo window has elapsed. */
  onTimeout?: () => void;
}

interface ToastStore {
  toasts: Toast[];
  show: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

/**
 * Singleton store for the toast queue. `show()` pushes a toast and
 * schedules an auto-dismiss after the configured duration. The
 * `<Toast />` component mounted at app root renders the live region.
 *
 * Toasts carry their own aria-live polite container — they're for
 * async feedback ("Saved", "Couldn't save", "Deleted — Undo") not for
 * form-validation summaries. Forms continue to use FormErrorSummary
 * so the assertive announcement and focus-jump still happens for
 * submit errors.
 */
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: ({ message, kind = "info", action, durationMs = 3000, onTimeout }) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((s) => ({ toasts: [...s.toasts, { id, message, kind, action }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        // Only fire onTimeout if the toast is still queued — if the
        // user dismissed it (via action click or close button), it's
        // already gone and we shouldn't run the commit handler.
        let stillQueued = false;
        set((s) => {
          stillQueued = s.toasts.some((t) => t.id === id);
          return { toasts: s.toasts.filter((t) => t.id !== id) };
        });
        if (stillQueued) onTimeout?.();
      }, durationMs);
    }
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience that any component can call without importing the store. */
export function showToast(input: ToastInput) {
  useToastStore.getState().show(input);
}
