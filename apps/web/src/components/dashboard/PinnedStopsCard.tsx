import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import { usePinnedStops } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { vehicleModeLabel } from "../../lib/transit-utils";

/**
 * Pinned stops card on the dashboard (DASH-3 — partial). Renders for
 * signed-in users once they have at least one pinned stop. Each row
 * deep-links into the transit page so the user lands on a primed
 * DepartureBoard for the pin they tapped.
 *
 * Hidden entirely when the list is empty rather than rendering an empty
 * state — anonymous and "haven't pinned anything yet" users see no
 * placeholder card cluttering the dashboard.
 */
export function PinnedStopsCard() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data, isLoading } = usePinnedStops(Boolean(user));

  if (!user) return null;
  if (isLoading) return null;
  const pins = data?.data ?? [];
  if (pins.length === 0) return null;

  return (
    <section
      className="pinned-stops-card"
      aria-label={intl.formatMessage({
        id: "dashboard.pinnedStops.title",
      })}
    >
      <p className="pinned-stops-card__kicker">
        <FormattedMessage id="dashboard.pinnedStops.kicker" />
      </p>
      <h3 className="pinned-stops-card__title">
        <FormattedMessage id="dashboard.pinnedStops.title" />
      </h3>
      <ul className="pinned-stops-card__list">
        {pins.map((pin) => (
          <li key={pin.id} className="pinned-stops-card__item">
            <Link
              to={`/transit?stopId=${encodeURIComponent(pin.gtfsId)}`}
              className="pinned-stops-card__link"
            >
              <span className="pinned-stops-card__name">{pin.name}</span>
              {pin.vehicleMode && (
                <span className="pinned-stops-card__mode">
                  {vehicleModeLabel(pin.vehicleMode)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
