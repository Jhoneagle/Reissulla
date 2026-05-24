import { useCallback, useRef, useState } from "react";

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingState extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

/**
 * Imperative `confirm()` replacement. Call `confirm({ title, ... })` and
 * await the resolved boolean. Render `state` into `<ConfirmDialog />`
 * with `onResolve={resolve}` so the dialog can fulfill the promise.
 *
 * Designed so a component holds one of these hooks and a single
 * `<ConfirmDialog ... />` in its JSX — keeping the imperative call
 * style without forcing a global modal portal.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingState | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...request, resolve });
    });
  }, []);

  const resolve = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPending(null);
  }, []);

  return {
    confirm,
    /** Pass these to <ConfirmDialog />. */
    dialogProps: {
      isOpen: pending !== null,
      title: pending?.title ?? "",
      body: pending?.body,
      confirmLabel: pending?.confirmLabel,
      cancelLabel: pending?.cancelLabel,
      destructive: pending?.destructive,
      onResolve: resolve,
    },
  };
}
