import { useId } from "react";
import { useIntl } from "react-intl";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onResolve: (confirmed: boolean) => void;
}

/**
 * Generic confirmation dialog used by the `useConfirm` hook. Renders a
 * `Modal` with a heading, optional body, and Cancel / Confirm buttons.
 * `destructive` swaps the confirm button to the destructive variant and
 * picks "Delete" as the default confirm label. Focus lands on the Cancel
 * button (Modal focuses the first focusable child) so the safer choice
 * is the default — particularly important for destructive prompts.
 */
export function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  onResolve,
}: ConfirmDialogProps) {
  const intl = useIntl();
  const headingId = useId();
  const bodyId = useId();
  const resolvedCancel =
    cancelLabel ?? intl.formatMessage({ id: "confirm.cancel" });
  const resolvedConfirm =
    confirmLabel ??
    intl.formatMessage({
      id: destructive ? "confirm.confirmDelete" : "confirm.confirmGeneric",
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onResolve(false)}
      labelledBy={headingId}
      describedBy={body ? bodyId : undefined}
      className="confirm-dialog"
    >
      <h2 id={headingId}>{title}</h2>
      {body && (
        <p id={bodyId} className="confirm-dialog__body">
          {body}
        </p>
      )}
      <div className="confirm-dialog__actions">
        <button
          type="button"
          className="link-button"
          onClick={() => onResolve(false)}
        >
          {resolvedCancel}
        </button>
        <button
          type="button"
          className={destructive ? "btn-destructive" : undefined}
          onClick={() => onResolve(true)}
        >
          {resolvedConfirm}
        </button>
      </div>
    </Modal>
  );
}
