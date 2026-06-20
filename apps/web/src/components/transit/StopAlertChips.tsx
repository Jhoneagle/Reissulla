import { useIntl } from "react-intl";
import type { AlertSeverity, TransitDeparture } from "@reissulla/shared";
import { useLiveAlerts } from "../../hooks/useAlerts";

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  info: "ⓘ",
  warning: "!",
  severe: "✕",
};

/**
 * Inline service-alert chips for a stop's departure board. One chip per active
 * alert affecting the stop or any line currently departing from it. The chip
 * shows an icon + route shortName; the full description sits in a `<details>`
 * body, and the summary carries an SR sentence so it isn't icon-only.
 */
export function StopAlertChips({
  stopId,
  departures,
}: {
  stopId: string;
  departures: TransitDeparture[];
}): React.JSX.Element | null {
  const intl = useIntl();
  const locale = intl.locale === "en" ? "en" : "fi";

  const routeNames = new Map<string, string>();
  for (const d of departures) {
    if (d.routeGtfsId) routeNames.set(d.routeGtfsId, d.routeShortName);
  }

  const { alerts } = useLiveAlerts({
    stops: [stopId],
    routes: Array.from(routeNames.keys()),
  });
  if (alerts.length === 0) return null;

  return (
    <div className="stop-alert-chips">
      {alerts.map((alert) => {
        const routeName =
          alert.scope.kind === "route"
            ? routeNames.get(alert.scope.gtfsId)
            : undefined;
        const summary =
          alert.headline[locale].trim() || alert.description[locale].trim();
        const body = alert.description[locale].trim();
        const visibleLabel =
          routeName ??
          intl.formatMessage({ id: `alert.severity.${alert.severity}` });
        const ariaLabel = routeName
          ? intl.formatMessage(
              { id: "alert.chip.route" },
              { route: routeName, summary },
            )
          : intl.formatMessage({ id: "alert.chip.generic" }, { summary });

        return (
          <details
            key={alert.id}
            className={`alert-chip alert-chip--${alert.severity}`}
          >
            <summary aria-label={ariaLabel}>
              <span className="alert-chip__icon" aria-hidden="true">
                {SEVERITY_ICON[alert.severity]}
              </span>
              <span className="alert-chip__label">{visibleLabel}</span>
            </summary>
            {body && <p className="alert-chip__body">{body}</p>}
          </details>
        );
      })}
    </div>
  );
}
