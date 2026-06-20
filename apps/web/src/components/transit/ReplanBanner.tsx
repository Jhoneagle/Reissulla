import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type {
  Alert,
  AlertSeverity,
  ReplanResult,
  TransitItinerary,
} from "@reissulla/shared";
import { useLiveAlerts } from "../../hooks/useAlerts";
import { useDismissedWarnings } from "../../hooks/useDismissedWarnings";
import { formatDepartureTime, formatDuration } from "../../lib/transit-utils";
import { ItineraryCard } from "./ItineraryCard";
import "./Replan.css";

const SEVERITY_ICON = "!";
const DOT_SEP = "·";
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  severe: 2,
};

/** Highest severity across the alerts that drove the suggestion. */
function topSeverity(alerts: Alert[]): AlertSeverity {
  let top: AlertSeverity = "warning";
  let rank = SEVERITY_RANK.warning;
  for (const a of alerts) {
    if (SEVERITY_RANK[a.severity] > rank) {
      top = a.severity;
      rank = SEVERITY_RANK[a.severity];
    }
  }
  return top;
}

/**
 * Resolve the triggering alerts from the live alert set by the ids the API
 * returned. The API ships only ids on `reason` (per technical-plan §6.4); the
 * FE already holds the active set through `useLiveAlerts`, so the banner reads
 * headline / severity / dismissal-endTime from there without a second fetch.
 * An alert that has since cleared simply drops out — the banner degrades to a
 * generic summary rather than rendering stale text.
 */
function useTriggeringAlerts(alertIds: string[]): Alert[] {
  const { alerts } = useLiveAlerts();
  const idKey = alertIds.join(",");
  return useMemo(
    () => alerts.filter((a) => alertIds.includes(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alerts, idKey],
  );
}

/**
 * Disruption-driven re-plan surface (LIVE-6). Owns the recommended itinerary
 * slot: shows a severity-styled banner above it, lets the user reveal the
 * pre-computed alternative (dimming the original while it's shown), and adopt
 * the alternative or keep the original (dismissed for the alert's lifetime,
 * 24 h fallback, via the shared dismissal store).
 */
export function ReplanBanner({
  original,
  suggestion,
}: {
  original: TransitItinerary;
  suggestion: ReplanResult;
}): React.JSX.Element {
  const intl = useIntl();
  const locale = intl.locale === "en" ? "en" : "fi";
  const { isDismissed, dismiss } = useDismissedWarnings();
  const [expanded, setExpanded] = useState(false);
  const [usingAlternative, setUsingAlternative] = useState(false);

  const alertIds = suggestion.reason?.alertIds ?? [];
  const triggering = useTriggeringAlerts(alertIds);
  const primary = triggering[0];
  const severity = topSeverity(triggering);
  const dismissKey = primary?.id ?? alertIds[0];

  const alternative = suggestion.alternative?.itineraries[0];

  // Once the user adopts the alternative the slot becomes the alternative plan.
  if (usingAlternative && alternative) {
    return (
      <div className="replan-slot">
        <p className="replan-slot__adopted" role="status">
          <FormattedMessage id="transit.replan.adopted" />
        </p>
        <ItineraryCard itinerary={alternative} index={0} />
      </div>
    );
  }

  // No alternative to offer, or the user kept the original: render it plainly.
  if (!alternative || (dismissKey !== undefined && isDismissed(dismissKey))) {
    return <ItineraryCard itinerary={original} index={0} />;
  }

  const headline = primary ? primary.headline[locale].trim() : "";
  const summary =
    headline.length > 0
      ? headline
      : intl.formatMessage({ id: "transit.replan.disruptionGeneric" });

  return (
    <div className="replan-slot">
      <section
        className={`replan-banner replan-banner--${severity}`}
        aria-label={intl.formatMessage({ id: "transit.replan.title" })}
      >
        <span className="replan-banner__icon" aria-hidden="true">
          {SEVERITY_ICON}
        </span>
        <div className="replan-banner__body">
          <span className="replan-banner__title">
            <FormattedMessage id="transit.replan.title" />
          </span>
          <p className="replan-banner__summary">{summary}</p>
        </div>
        <div className="replan-banner__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <FormattedMessage id="transit.replan.hideAlternative" />
            ) : (
              <FormattedMessage id="transit.replan.showAlternative" />
            )}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              dismissKey !== undefined &&
              dismiss(dismissKey, primary?.endTime ?? undefined)
            }
          >
            <FormattedMessage id="transit.replan.keepOriginal" />
          </button>
        </div>
      </section>

      <ItineraryCard itinerary={original} index={0} deemphasised={expanded} />

      {expanded && (
        <div className="replan-alternative">
          <ItineraryCard
            itinerary={alternative}
            index={0}
            labelId="transit.replan.alternativeOption"
          />
          <button
            type="button"
            className="btn btn--primary btn--sm replan-alternative__use"
            onClick={() => setUsingAlternative(true)}
          >
            <FormattedMessage id="transit.replan.useAlternative" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * TRIP-18 alternatives surface. Shown when a `SIGNIFICANT_DELAYS` alert touches
 * the recommended route but no route ban was warranted — points the user at the
 * other itineraries the planner already returned, as a compact glanceable list.
 */
export function AlternativesList({
  alternatives,
  alertIds,
}: {
  alternatives: TransitItinerary[];
  alertIds: string[];
}): React.JSX.Element | null {
  const intl = useIntl();
  const locale = intl.locale === "en" ? "en" : "fi";
  const triggering = useTriggeringAlerts(alertIds);
  const primary = triggering[0];

  if (alternatives.length === 0) return null;

  const headline = primary ? primary.headline[locale].trim() : "";
  const summary =
    headline.length > 0
      ? headline
      : intl.formatMessage({ id: "transit.replan.delaysGeneric" });

  return (
    <section
      className="alternatives-list"
      aria-label={intl.formatMessage({
        id: "transit.replan.alternativesTitle",
      })}
    >
      <div className="alternatives-list__head">
        <span className="alternatives-list__title">
          <FormattedMessage id="transit.replan.alternativesTitle" />
        </span>
        <p className="alternatives-list__summary">{summary}</p>
      </div>
      <ul className="alternatives-list__items">
        {alternatives.map((it, i) => (
          <li key={`${it.startTime}-${it.endTime}-${i}`}>
            <span className="alternatives-list__time">
              {formatDepartureTime(it.startTime)}
            </span>
            <span className="alternatives-list__sep" aria-hidden="true">
              {DOT_SEP}
            </span>
            <span className="alternatives-list__duration">
              {formatDuration(it.duration)}
            </span>
            <span className="alternatives-list__sep" aria-hidden="true">
              {DOT_SEP}
            </span>
            <span className="alternatives-list__transfers">
              {it.transfers === 0 ? (
                <FormattedMessage id="transit.itinerary.direct" />
              ) : (
                intl.formatMessage(
                  { id: "transit.itinerary.transfers" },
                  { n: it.transfers },
                )
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
