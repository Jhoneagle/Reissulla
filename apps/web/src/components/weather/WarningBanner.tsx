import { useCallback, useEffect, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { WeatherWarning, WeatherWarningSeverity } from "@reissulla/shared";
import { useDismissedWarnings } from "../../hooks/useDismissedWarnings";

interface WarningBannerProps {
  warnings: WeatherWarning[];
  /**
   * Visually-hidden heading id the dashboard exposes for focus
   * restoration. When the last visible banner is dismissed, focus moves
   * to this element so the user lands somewhere meaningful rather than
   * on a vanished button.
   */
  restoreFocusToId?: string;
}

/**
 * Severity → existing token bucket. The plan deliberately avoids inventing
 * a new orange token; minor / moderate ride on the warning palette,
 * severe / extreme ride on the error palette.
 */
function severityClass(severity: WeatherWarningSeverity): string {
  switch (severity) {
    case "minor":
      return "warning-banner--minor";
    case "moderate":
      return "warning-banner--moderate";
    case "severe":
      return "warning-banner--severe";
    case "extreme":
      return "warning-banner--extreme";
  }
}

function ariaPoliteness(
  severity: WeatherWarningSeverity,
): "polite" | "assertive" {
  return severity === "severe" || severity === "extreme"
    ? "assertive"
    : "polite";
}

/**
 * Stack of FMI weather warnings sitting above the dashboard primary card.
 * Each warning is dismissible per id; the dismissal persists in
 * localStorage until the warning's `endTime` passes (24 h fallback when
 * absent). The first appearance reads through an `aria-live` region —
 * polite for minor/moderate, assertive for severe/extreme — and focus
 * jumps to the next banner (or the configured restore-focus target)
 * after dismissal.
 */
export function WarningBanner({
  warnings,
  restoreFocusToId,
}: WarningBannerProps) {
  const intl = useIntl();
  const { isDismissed, dismiss } = useDismissedWarnings();

  const visible = warnings.filter((w) => !isDismissed(w.id));
  if (visible.length === 0) return null;

  return (
    <section
      className="warning-stack"
      aria-label={intl.formatMessage({
        id: "weather.warning.region.label",
      })}
    >
      {visible.map((w, index) => (
        <WarningBannerItem
          key={w.id}
          warning={w}
          isFirst={index === 0}
          onDismiss={(id) => {
            dismiss(id, w.endTime);
            handleDismissFocus(id, visible, restoreFocusToId);
          }}
        />
      ))}
    </section>
  );
}

interface WarningBannerItemProps {
  warning: WeatherWarning;
  /** When true, the banner's container becomes an aria-live region. */
  isFirst: boolean;
  onDismiss: (id: string) => void;
}

function WarningBannerItem({
  warning,
  isFirst,
  onDismiss,
}: WarningBannerItemProps) {
  const intl = useIntl();
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Mark on mount that this warning id has been seen, so the next
  // refetch doesn't re-trigger the live region for the same warning.
  const seenRef = useRef(false);
  useEffect(() => {
    seenRef.current = true;
  }, [warning.id]);

  const severityLabel = intl.formatMessage({
    id: `weather.warning.severity.${warning.severity}`,
  });
  const typeLabel = intl.formatMessage({
    id: `weather.warning.type.${warning.type}`,
  });
  const untilLabel = intl.formatTime(warning.endTime, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const body =
    warning.description.trim().length > 0
      ? warning.description
      : intl.formatMessage(
          { id: "weather.warning.fallback" },
          {
            severity: severityLabel,
            type: typeLabel,
            until: untilLabel,
          },
        );

  const handleDismiss = useCallback(() => {
    onDismiss(warning.id);
  }, [onDismiss, warning.id]);

  const liveProps = isFirst
    ? {
        "aria-live": ariaPoliteness(warning.severity),
        "aria-atomic": true,
      }
    : {};

  return (
    <article
      data-testid="warning-banner"
      data-warning-id={warning.id}
      className={`warning-banner ${severityClass(warning.severity)}`}
      role="status"
      {...liveProps}
    >
      <div className="warning-banner__body">
        <span className="warning-banner__severity">
          <FormattedMessage
            id={`weather.warning.severity.${warning.severity}`}
          />
        </span>
        <p className="warning-banner__text">{body}</p>
      </div>
      <button
        ref={dismissRef}
        type="button"
        className="warning-banner__dismiss"
        onClick={handleDismiss}
        aria-label={intl.formatMessage({ id: "weather.warning.dismiss" })}
      >
        <span aria-hidden="true">×</span>
      </button>
    </article>
  );
}

/**
 * After a banner is dismissed, move focus to the next still-visible
 * banner's dismiss button. When the dismissed banner was the last
 * visible one, fall back to the consumer-supplied `restoreFocusToId`
 * (typically the visually-hidden dashboard `<h1>`), per §14.2.
 *
 * Runs after React has updated the DOM, so we use a microtask defer.
 */
function handleDismissFocus(
  dismissedId: string,
  beforeDismiss: WeatherWarning[],
  restoreFocusToId: string | undefined,
): void {
  // Find next visible warning id (still-active after dismissing this one).
  const dismissedIndex = beforeDismiss.findIndex((w) => w.id === dismissedId);
  const next = beforeDismiss[dismissedIndex + 1];

  queueMicrotask(() => {
    if (next !== undefined) {
      const el = document.querySelector<HTMLButtonElement>(
        `[data-warning-id="${cssEscape(next.id)}"] .warning-banner__dismiss`,
      );
      if (el) {
        el.focus();
        return;
      }
    }
    if (restoreFocusToId !== undefined) {
      const el = document.getElementById(restoreFocusToId);
      if (el) el.focus();
    }
  });
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\\n]/g, "\\$&");
}
