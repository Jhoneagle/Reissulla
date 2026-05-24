import { useEffect, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";

interface TimePickerDialogProps {
  /** Current target time in unix seconds, or undefined for "now". */
  value: number | undefined;
  /** Called with new unix seconds, or undefined to revert to "now". */
  onChange: (next: number | undefined) => void;
  open: boolean;
  onClose: () => void;
}

function toDatetimeLocalValue(unix: number | undefined): string {
  if (!unix) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(unix * 1000))) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  if (parts.hour === "24") parts.hour = "00";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function fromDatetimeLocalValue(value: string): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return Math.floor(ms / 1000);
}

export function TimePickerDialog({
  value,
  onChange,
  open,
  onClose,
}: TimePickerDialogProps) {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      // Reset the uncontrolled input to the current value on each open so
      // a cancelled edit doesn't leak into the next session, then surface
      // the dialog so the native <dialog> handles initial focus.
      if (inputRef.current) {
        inputRef.current.value = toDatetimeLocalValue(value);
      }
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open, value]);

  function handleApply() {
    onChange(fromDatetimeLocalValue(inputRef.current?.value ?? ""));
    onClose();
  }

  function handleNow() {
    onChange(undefined);
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="time-picker-dialog"
      onClose={onClose}
      aria-label={intl.formatMessage({ id: "transit.depart.time.dialogLabel" })}
    >
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <h2 className="time-picker-dialog__title">
          <FormattedMessage id="transit.depart.time.heading" />
        </h2>
        <label className="time-picker-dialog__field">
          <span className="time-picker-dialog__field-label">
            <FormattedMessage id="transit.depart.time.fieldLabel" />
          </span>
          <input
            ref={inputRef}
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(value)}
          />
        </label>
        <div className="time-picker-dialog__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleNow}
          >
            <FormattedMessage id="transit.depart.time.useNow" />
          </button>
          <span className="time-picker-dialog__actions-spacer" />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onClose}
          >
            <FormattedMessage id="transit.depart.time.cancel" />
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleApply}
          >
            <FormattedMessage id="transit.depart.time.apply" />
          </button>
        </div>
      </form>
    </dialog>
  );
}
