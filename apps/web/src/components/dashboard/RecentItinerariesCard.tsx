import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import type { TransitItinerary } from "@reissulla/shared";
import { useAuthStore } from "../../stores/auth";
import { useHistory } from "../../hooks/useHistory";
import { ItineraryCard } from "../transit/ItineraryCard";
import { ItineraryDrawer } from "../transit/ItineraryDrawer";
import "./recent-itineraries-card.css";

/**
 * DASH-6 — the three most recent recorded trips. Mounts only when the trip
 * log has entries. Clicking a row replays the snapshot itinerary in a drawer
 * (no full-page nav, so dashboard scrollback is preserved); a "See all" link
 * deep-links to the full History page.
 */
export function RecentItinerariesCard() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data } = useHistory(Boolean(user), { limit: 3 });
  const [selected, setSelected] = useState<TransitItinerary | null>(null);

  if (!user) return null;
  const trips = data?.data ?? [];
  if (trips.length === 0) return null;

  return (
    <section
      className="recent-itineraries-card"
      aria-label={intl.formatMessage({ id: "history.recent.title" })}
    >
      <p className="recent-itineraries-card__kicker">
        <FormattedMessage id="history.recent.kicker" />
      </p>
      <h3 className="recent-itineraries-card__title">
        <FormattedMessage id="history.recent.title" />
      </h3>
      <ul className="recent-itineraries-card__list">
        {trips.map((entry) => (
          <li key={entry.id} className="recent-itineraries-card__item">
            <button
              type="button"
              className="recent-itineraries-card__row"
              onClick={() => setSelected(entry.itinerary)}
            >
              <span className="recent-itineraries-card__date">
                {intl.formatDate(entry.plannedAt, { dateStyle: "medium" })}
              </span>
              <ItineraryCard itinerary={entry.itinerary} index={0} compact />
            </button>
          </li>
        ))}
      </ul>
      <div className="recent-itineraries-card__footer">
        <Link to="/history" className="recent-itineraries-card__all">
          <FormattedMessage id="history.recent.seeAll" />
        </Link>
      </div>
      <ItineraryDrawer itinerary={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
