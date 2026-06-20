import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import { usePinnedLines } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { vehicleModeLabel, vehicleModeToken } from "../../lib/transit-utils";
import "./pinned-lines-card.css";

/**
 * Pinned-lines card on the dashboard (DASH-4). Mirrors PinnedStopsCard:
 * renders for signed-in users with at least one pinned line, deep-links each
 * row to the LineView, and hides entirely when the list is empty.
 */
export function PinnedLinesCard() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data, isLoading } = usePinnedLines(Boolean(user));

  if (!user) return null;
  if (isLoading) return null;
  const pins = data?.data ?? [];
  if (pins.length === 0) return null;

  return (
    <section
      className="pinned-lines-card"
      aria-label={intl.formatMessage({ id: "dashboard.pinnedLines.title" })}
    >
      <p className="pinned-lines-card__kicker">
        <FormattedMessage id="dashboard.pinnedLines.kicker" />
      </p>
      <h3 className="pinned-lines-card__title">
        <FormattedMessage id="dashboard.pinnedLines.title" />
      </h3>
      <ul className="pinned-lines-card__list">
        {pins.map((pin) => {
          const modeToken = vehicleModeToken(pin.vehicleMode);
          return (
            <li
              key={pin.id}
              className={`pinned-lines-card__item pinned-lines-card__item--mode-${modeToken}`}
            >
              <Link
                to={`/transit/line/${encodeURIComponent(pin.gtfsId)}`}
                className="pinned-lines-card__link"
              >
                <span
                  className={`pinned-lines-card__mode pinned-lines-card__mode--${modeToken}`}
                >
                  {vehicleModeLabel(pin.vehicleMode)}
                </span>
                <span className="pinned-lines-card__name">{pin.name}</span>
              </Link>
              <Link
                to={`/transit/line/${encodeURIComponent(pin.gtfsId)}#live`}
                className="pinned-lines-card__live"
              >
                <FormattedMessage id="dashboard.pinnedLines.viewLive" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
