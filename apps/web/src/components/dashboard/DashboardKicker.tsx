import { useIntl } from "react-intl";

/**
 * "REISSULLA WEEKLY · MAANANTAI 23. TOUKOKUUTA · KEVÄT" — the
 * masthead-style kicker that sits above the primary card. Three
 * columns: publication wordmark | locale-aware date | auto-detected
 * season. IBM Plex Mono, tracked, uppercase, in the muted ink token.
 *
 * Decorative. The page-level h1 (visually hidden, owned by
 * PageHeading) carries the route's semantic heading; this is
 * editorial decoration that helps the dashboard feel like the front
 * page of a paper.
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
      <span className="dashboard-kicker__publication">Reissulla Weekly</span>
      <span className="dashboard-kicker__sep">·</span>
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
