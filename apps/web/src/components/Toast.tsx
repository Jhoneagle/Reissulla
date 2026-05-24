import { useToastStore } from "../stores/toast";

/**
 * Toast container — singleton, mounted once at app root. Renders the
 * live queue from the toast store inside an aria-live polite region so
 * screen-readers announce each new message without interrupting.
 *
 * Visual position: bottom-centre, stacked. Each toast auto-dismisses
 * after 3 seconds (driven by the store) and can be dismissed manually.
 */
export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__message">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast__dismiss"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
