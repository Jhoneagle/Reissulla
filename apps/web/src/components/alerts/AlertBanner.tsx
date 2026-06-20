import { useCallback, useEffect, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type {
  Alert,
  AlertSeverity,
  WeatherWarning,
  WeatherWarningSeverity,
} from "@reissulla/shared";
import { isAssertiveAlert } from "@reissulla/shared";
import { useDismissedWarnings } from "../../hooks/useDismissedWarnings";
import "./Alerts.css";

/**
 * One banner component for every alert surface. `kind` selects the source
 * shape:
 *   - `weather` renders FMI `WeatherWarning[]` (the dashboard per-location
 *     surface shipped in Phase 3 — markup and politeness preserved verbatim,
 *     including the rich severity + type label the warning carries).
 *   - `transit` / `road` render the composed `Alert[]` (Digitransit / future
 *     Fintraffic). Politeness follows the safety-of-life rule in
 *     `isAssertiveAlert`; everything else stays polite.
 *
 * Both share the editorial 4px-bar styling, the dismiss store (keyed by id +
 * endTime), and the focus-restore-after-dismiss behaviour.
 */
type AlertBannerProps =
  | {
      kind: "weather";
      warnings: WeatherWarning[];
      restoreFocusToId?: string;
    }
  | {
      kind: "transit" | "road";
      alerts: Alert[];
      /** When false, no item becomes an aria-live region (a parent announces
       * a summary instead — e.g. the DASH-5 count guard). Defaults to true. */
      live?: boolean;
      restoreFocusToId?: string;
    };

export function AlertBanner(props: AlertBannerProps): React.JSX.Element | null {
  if (props.kind === "weather") {
    return (
      <WeatherWarningStack
        warnings={props.warnings}
        restoreFocusToId={props.restoreFocusToId}
      />
    );
  }
  return (
    <AlertStack
      alerts={props.alerts}
      live={props.live ?? true}
      restoreFocusToId={props.restoreFocusToId}
    />
  );
}

// ---------------------------------------------------------------------------
// Transit / road alerts
// ---------------------------------------------------------------------------

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  info: "ⓘ",
  warning: "!",
  severe: "✕",
};

function severityClass(severity: AlertSeverity): string {
  return `alert-banner--${severity}`;
}

function AlertStack({
  alerts,
  live,
  restoreFocusToId,
}: {
  alerts: Alert[];
  live: boolean;
  restoreFocusToId?: string;
}): React.JSX.Element | null {
  const intl = useIntl();
  const { isDismissed, dismiss } = useDismissedWarnings();

  const visible = alerts.filter((a) => !isDismissed(a.id));
  if (visible.length === 0) return null;

  return (
    <section
      className="alert-stack"
      aria-label={intl.formatMessage({ id: "alert.region.label" })}
    >
      {visible.map((alert, index) => (
        <AlertBannerItem
          key={alert.id}
          alert={alert}
          isLive={live && index === 0}
          onDismiss={(id) => {
            dismiss(id, alert.endTime ?? undefined);
            handleDismissFocus(
              id,
              visible.map((a) => a.id),
              restoreFocusToId,
            );
          }}
        />
      ))}
    </section>
  );
}

function AlertBannerItem({
  alert,
  isLive,
  onDismiss,
}: {
  alert: Alert;
  isLive: boolean;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const locale = intl.locale === "en" ? "en" : "fi";

  const severityLabel = intl.formatMessage({
    id: `alert.severity.${alert.severity}`,
  });
  const headline = alert.headline[locale].trim();
  const body = alert.description[locale].trim();

  const handleDismiss = useCallback(() => {
    onDismiss(alert.id);
  }, [onDismiss, alert.id]);

  const liveProps = isLive
    ? {
        "aria-live": isAssertiveAlert(alert)
          ? ("assertive" as const)
          : ("polite" as const),
        "aria-atomic": true,
      }
    : {};

  return (
    <article
      data-testid="alert-banner"
      data-alert-id={alert.id}
      className={`alert-banner ${severityClass(alert.severity)}`}
      role="status"
      {...liveProps}
    >
      <span className="alert-banner__icon" aria-hidden="true">
        {SEVERITY_ICON[alert.severity]}
      </span>
      <div className="alert-banner__body">
        <span className="alert-banner__severity">{severityLabel}</span>
        {headline.length > 0 && (
          <p className="alert-banner__headline">{headline}</p>
        )}
        {body.length > 0 && headline !== body && (
          <p className="alert-banner__text">{body}</p>
        )}
      </div>
      <button
        type="button"
        className="alert-banner__dismiss"
        onClick={handleDismiss}
        aria-label={intl.formatMessage({ id: "alert.dismiss" })}
      >
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
        <span aria-hidden="true">×</span>
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Weather warnings (Phase 3 surface — preserved verbatim under `kind="weather"`)
// ---------------------------------------------------------------------------

function weatherSeverityClass(severity: WeatherWarningSeverity): string {
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

function weatherPoliteness(
  severity: WeatherWarningSeverity,
): "polite" | "assertive" {
  return severity === "severe" || severity === "extreme"
    ? "assertive"
    : "polite";
}

function WeatherWarningStack({
  warnings,
  restoreFocusToId,
}: {
  warnings: WeatherWarning[];
  restoreFocusToId?: string;
}): React.JSX.Element | null {
  const intl = useIntl();
  const { isDismissed, dismiss } = useDismissedWarnings();

  const visible = warnings.filter((w) => !isDismissed(w.id));
  if (visible.length === 0) return null;

  return (
    <section
      className="warning-stack"
      aria-label={intl.formatMessage({ id: "weather.warning.region.label" })}
    >
      {visible.map((w, index) => (
        <WeatherWarningItem
          key={w.id}
          warning={w}
          isFirst={index === 0}
          onDismiss={(id) => {
            dismiss(id, w.endTime);
            handleDismissFocus(
              id,
              visible.map((x) => x.id),
              restoreFocusToId,
              "warning",
            );
          }}
        />
      ))}
    </section>
  );
}

function WeatherWarningItem({
  warning,
  isFirst,
  onDismiss,
}: {
  warning: WeatherWarning;
  isFirst: boolean;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  const intl = useIntl();
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
          { severity: severityLabel, type: typeLabel, until: untilLabel },
        );

  const handleDismiss = useCallback(() => {
    onDismiss(warning.id);
  }, [onDismiss, warning.id]);

  const liveProps = isFirst
    ? {
        "aria-live": weatherPoliteness(warning.severity),
        "aria-atomic": true,
      }
    : {};

  return (
    <article
      data-testid="warning-banner"
      data-warning-id={warning.id}
      className={`warning-banner ${weatherSeverityClass(warning.severity)}`}
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
        type="button"
        className="warning-banner__dismiss"
        onClick={handleDismiss}
        aria-label={intl.formatMessage({ id: "weather.warning.dismiss" })}
      >
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
        <span aria-hidden="true">×</span>
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shared focus restore
// ---------------------------------------------------------------------------

/**
 * After a banner is dismissed, move focus to the next still-visible banner's
 * dismiss button; when the dismissed one was last, fall back to the
 * consumer-supplied restore target (typically the dashboard `<h1>`).
 */
function handleDismissFocus(
  dismissedId: string,
  orderedIds: string[],
  restoreFocusToId: string | undefined,
  variant: "alert" | "warning" = "alert",
): void {
  const dismissedIndex = orderedIds.indexOf(dismissedId);
  const nextId = orderedIds[dismissedIndex + 1];
  const attr = variant === "alert" ? "data-alert-id" : "data-warning-id";
  const dismissClass =
    variant === "alert" ? "alert-banner__dismiss" : "warning-banner__dismiss";

  queueMicrotask(() => {
    if (nextId !== undefined) {
      const el = document.querySelector<HTMLButtonElement>(
        `[${attr}="${cssEscape(nextId)}"] .${dismissClass}`,
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
