import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: Toast[];
  show: (input: { message: string; kind?: ToastKind }) => void;
  dismiss: (id: string) => void;
}

/**
 * Singleton store for the toast queue. `show()` pushes a toast and
 * schedules an auto-dismiss after 3 seconds. The `<Toast />` component
 * mounted at app root renders the live region and the visible queue.
 *
 * Toasts carry their own aria-live polite container — they're for
 * async feedback ("Saved", "Couldn't save") not for form-validation
 * summaries. Forms continue to use `<FormErrorSummary />` so the
 * assertive announcement and focus-jump still happens for submit
 * errors.
 */
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: ({ message, kind = "info" }) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 3000);
    }
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience that any component can call without importing the store. */
export function showToast(input: { message: string; kind?: ToastKind }) {
  useToastStore.getState().show(input);
}
