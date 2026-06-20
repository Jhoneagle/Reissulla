import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useLiveAlerts, type AlertScope } from "../../hooks/useAlerts";
import { usePinnedLines, usePinnedStops } from "../../hooks/useTransit";
import { useSavedLocations } from "../../hooks/useSavedLocations";
import { AlertBanner } from "../alerts/AlertBanner";
import { showToast } from "../../stores/toast";

/** At or above this count the banner collapses to a one-line summary. */
const COLLAPSE_THRESHOLD = 3;

/**
 * DASH-5 — today's alerts affecting the user's pins. Mounts above the primary
 * card when the composed set (filtered to pinned stops / lines / saved-location
 * regions) is non-empty.
 *
 * Announcement discipline (so opening the app mid-disruption doesn't fire an
 * announcement storm): on first paint a polite live region announces the
 * *count* only; alerts arriving later in the session toast in full, once each.
 */
export function TodayAlerts(): React.JSX.Element | null {
  const intl = useIntl();
  const locale = intl.locale === "en" ? "en" : "fi";
  const pinnedStops = usePinnedStops();
  const pinnedLines = usePinnedLines();
  const saved = useSavedLocations();

  const scope = useMemo<AlertScope>(
    () => ({
      routes: (pinnedLines.data?.data ?? []).map((l) => l.gtfsId),
      stops: (pinnedStops.data?.data ?? []).map((s) => s.gtfsId),
      regions: Array.from(
        new Set(
          (saved.data?.data ?? [])
            .map((l) => l.region)
            .filter((r): r is string => Boolean(r)),
        ),
      ),
    }),
    [pinnedLines.data, pinnedStops.data, saved.data],
  );

  const { alerts } = useLiveAlerts(scope);
  const [expanded, setExpanded] = useState(false);

  const seenRef = useRef<Set<string> | null>(null);
  const [countAnnouncement, setCountAnnouncement] = useState("");
  useEffect(() => {
    if (seenRef.current === null) {
      // First load — announce the count, not every body.
      seenRef.current = new Set(alerts.map((a) => a.id));
      if (alerts.length > 0) {
        setCountAnnouncement(
          intl.formatMessage(
            { id: "alert.dashboard.count" },
            { count: alerts.length },
          ),
        );
      }
      return;
    }
    for (const alert of alerts) {
      if (seenRef.current.has(alert.id)) continue;
      seenRef.current.add(alert.id);
      const text =
        alert.headline[locale].trim() || alert.description[locale].trim();
      if (text) showToast({ message: text, kind: "info" });
    }
  }, [alerts, intl, locale]);

  const hasScope =
    (scope.routes?.length ?? 0) > 0 ||
    (scope.stops?.length ?? 0) > 0 ||
    (scope.regions?.length ?? 0) > 0;
  if (!hasScope) return null;

  const collapsed = alerts.length >= COLLAPSE_THRESHOLD && !expanded;

  return (
    <div className="today-alerts">
      <p className="visually-hidden" role="status" aria-live="polite">
        {countAnnouncement}
      </p>
      {alerts.length === 0 ? null : collapsed ? (
        <div className="alert-banner alert-banner--warning today-alerts__summary">
          <span className="alert-banner__icon" aria-hidden="true">
            !
          </span>
          <p className="alert-banner__headline">
            <FormattedMessage
              id="alert.dashboard.count"
              values={{ count: alerts.length }}
            />
          </p>
          <button
            type="button"
            className="today-alerts__toggle"
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
            restoreFocusToId="main-content"
          />
          {alerts.length >= COLLAPSE_THRESHOLD && (
            <button
              type="button"
              className="today-alerts__toggle"
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
