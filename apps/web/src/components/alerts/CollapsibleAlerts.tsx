import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { Alert, AlertSeverity } from "@reissulla/shared";
import { AlertBanner } from "./AlertBanner";

/**
 * Renders a list of transit alerts that folds to a one-line, count summary
 * once it reaches `threshold`, with an expand / collapse toggle. Shared by the
 * dashboard today's-alerts banner and the line-view banner so neither becomes
 * a wall of stacked banners. A polite live region announces the count (one
 * short phrase) rather than every alert body.
 */

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  info: "ⓘ",
  warning: "!",
  severe: "✕",
};
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  severe: 2,
};

function worstSeverity(alerts: Alert[]): AlertSeverity {
  return alerts.reduce<AlertSeverity>(
    (worst, a) =>
      SEVERITY_RANK[a.severity] > SEVERITY_RANK[worst] ? a.severity : worst,
    "info",
  );
}

interface CollapsibleAlertsProps {
  alerts: Alert[];
  /** Fold to a summary at or above this many alerts. Default 3. */
  threshold?: number;
  /** i18n id for the count summary / announcement. */
  summaryMessageId?: string;
  restoreFocusToId?: string;
  /** Announce the count politely on render. Default true. */
  announce?: boolean;
}

export function CollapsibleAlerts({
  alerts,
  threshold = 3,
  summaryMessageId = "alert.collapse.count",
  restoreFocusToId,
  announce = true,
}: CollapsibleAlertsProps): React.JSX.Element | null {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const countText = intl.formatMessage(
    { id: summaryMessageId },
    { count: alerts.length },
  );
  const collapsed = alerts.length >= threshold && !expanded;
  const severity = worstSeverity(alerts);

  return (
    <div className="alert-collapse">
      {announce && (
        <p className="visually-hidden" role="status" aria-live="polite">
          {countText}
        </p>
      )}
      {collapsed ? (
        <div
          className={`alert-banner alert-banner--${severity} alert-collapse__summary`}
        >
          <span className="alert-banner__icon" aria-hidden="true">
            {SEVERITY_ICON[severity]}
          </span>
          <p className="alert-banner__headline">{countText}</p>
          <button
            type="button"
            className="alert-collapse__toggle"
            onClick={() => setExpanded(true)}
          >
            <FormattedMessage id="alert.dashboard.expand" />
          </button>
        </div>
      ) : (
        <>
          <AlertBanner
            kind="transit"
            alerts={alerts}
            live={false}
            restoreFocusToId={restoreFocusToId}
          />
          {alerts.length >= threshold && (
            <button
              type="button"
              className="alert-collapse__toggle"
              onClick={() => setExpanded(false)}
            >
              <FormattedMessage id="alert.dashboard.collapse" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
