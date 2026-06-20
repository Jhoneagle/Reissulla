import { useEffect, useMemo, useRef } from "react";
import { isDisruption } from "@reissulla/shared";
import { useIntl } from "react-intl";
import { useLiveAlerts, type AlertScope } from "../../hooks/useAlerts";
import { usePinnedLines, usePinnedStops } from "../../hooks/useTransit";
import { useSavedLocations } from "../../hooks/useSavedLocations";
import { CollapsibleAlerts } from "../alerts/CollapsibleAlerts";
import { showToast } from "../../stores/toast";

/**
 * DASH-5 — today's alerts affecting the user's pins. Mounts above the primary
 * card when the composed set (filtered to pinned stops / lines / saved-location
 * regions) is non-empty. The list folds to a count summary via
 * `CollapsibleAlerts`; alerts arriving later in the session toast in full
 * (once each) so a mid-session disruption is noticed without re-reading the
 * whole list.
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

  const { alerts: scoped, isLoading } = useLiveAlerts(scope);
  // The dashboard banner is for service-affecting disruptions only; low-impact
  // info notices stay on the stop / line surfaces where they're in context.
  const alerts = useMemo(() => scoped.filter(isDisruption), [scoped]);

  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (seenRef.current === null) {
      // Baseline = the first settled set; these don't toast as "new".
      seenRef.current = new Set(alerts.map((a) => a.id));
      return;
    }
    for (const alert of alerts) {
      if (seenRef.current.has(alert.id)) continue;
      seenRef.current.add(alert.id);
      const text =
        alert.headline[locale].trim() || alert.description[locale].trim();
      if (text) showToast({ message: text, kind: "info" });
    }
  }, [alerts, isLoading, locale]);

  const hasScope =
    (scope.routes?.length ?? 0) > 0 ||
    (scope.stops?.length ?? 0) > 0 ||
    (scope.regions?.length ?? 0) > 0;
  if (!hasScope) return null;

  return (
    <div className="today-alerts">
      <CollapsibleAlerts
        alerts={alerts}
        summaryMessageId="alert.dashboard.count"
        restoreFocusToId="main-content"
      />
    </div>
  );
}
