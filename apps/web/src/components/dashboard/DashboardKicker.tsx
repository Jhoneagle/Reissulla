import { useIntl } from "react-intl";

/**
 * "SUNNUNTAI 24. TOUKOKUUTA · KEVÄT" — masthead-style date line
 * that sits above the primary card. Two columns: locale-aware date
 * | auto-detected season. IBM Plex Mono, tracked, uppercase, in
 * the muted ink token.
 *
 * Decorative (aria-hidden). The wordmark in the header already
 * names the publication; the kicker is the dateline. The page-level
 * h1 (visually hidden, owned by PageHeading) carries the route's
 * semantic heading.
 */
export function DashboardKicker() {
  const intl = useIntl();
  const now = new Date();

  const weekday = intl.formatDate(now, { weekday: "long" });
  const dateLine = intl.formatDate(now, {
    day: "numeric",
    month: "long",
  });
  const season = intl.formatMessage({
    id: `dashboard.season.${seasonForMonth(now.getMonth())}`,
  });

  return (
    <p className="dashboard-kicker" aria-hidden="true">
      <span className="dashboard-kicker__date">
        {weekday} {dateLine}
      </span>
      <span className="dashboard-kicker__sep">·</span>
      <span className="dashboard-kicker__season">{season}</span>
    </p>
  );
}

function seasonForMonth(
  monthIndex: number,
): "winter" | "spring" | "summer" | "autumn" {
  // Northern-hemisphere meteorological seasons (Helsinki time zone).
  // Dec / Jan / Feb → winter; Mar–May → spring; Jun–Aug → summer;
  // Sep–Nov → autumn.
  if (monthIndex === 11 || monthIndex <= 1) return "winter";
  if (monthIndex <= 4) return "spring";
  if (monthIndex <= 7) return "summer";
  return "autumn";
}
