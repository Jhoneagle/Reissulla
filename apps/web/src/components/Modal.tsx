import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Headless modal primitive. Renders a backdrop + dialog box, captures
 * Escape, focuses the dialog on mount, restores focus to the opener on
 * unmount, and traps Tab / Shift-Tab cycling inside the dialog.
 *
 * The backdrop carries no `role` attribute on purpose — `role="presentation"`
 * suppresses click events for some AT, which would silently break the
 * "click backdrop to dismiss" affordance. A bare `<div>` lets the click
 * handler land while staying invisible to the accessibility tree.
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** id used for the `aria-labelledby` link to the dialog heading. */
  labelledBy: string;
  /** Optional `aria-describedby` link to a description paragraph. */
  describedBy?: string;
  /** Click on backdrop dismisses unless overridden (defaults to true). */
  dismissOnBackdrop?: boolean;
  /** Escape key dismisses unless overridden (defaults to true). */
  dismissOnEscape?: boolean;
  className?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Defer focus a frame so any entrance animation has mounted children
    // by the time we look for the first focusable element.
    const id = requestAnimationFrame(() => {
      const firstFocusable =
        dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog).focus();
    });
    return () => {
      cancelAnimationFrame(id);
      const opener = openerRef.current;
      // Only restore focus to the opener if focus is still inside the
      // dialog at teardown — if the user clicked elsewhere or another
      // dialog opened, we should leave their focus alone.
      if (
        opener &&
        dialog.contains(document.activeElement) &&
        typeof opener.focus === "function"
      ) {
        opener.focus();
      }
    };
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (dismissOnEscape && e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismissOnEscape, onClose],
  );

  if (!isOpen) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!dismissOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  return (
    // The backdrop is intentionally not interactive in the accessibility
    // tree — Escape and the dialog's Cancel button cover keyboard / AT
    // users. The click-to-dismiss is a sighted-mouse convenience that
    // matches platform expectations. Adding a role here would either
    // suppress those clicks (role="presentation") or wrongly advertise
    // the backdrop as a focusable control.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      {/* The dialog owns its Escape / Tab trap logic — that's the
          entire point of a focus-trapped modal primitive. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={className ? `modal-dialog ${className}` : "modal-dialog"}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
