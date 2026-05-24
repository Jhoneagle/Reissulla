import { FormattedMessage, useIntl } from "react-intl";
import type { TransitItinerary } from "@reissulla/shared";
import {
  formatDepartureTime,
  formatDuration,
  formatWalkDistance,
} from "../../lib/transit-utils";
import { ItineraryLeg } from "./ItineraryLeg";

const RIGHT_ARROW = "→";

interface ItineraryCardProps {
  itinerary: TransitItinerary;
  index: number;
}

export function ItineraryCard({ itinerary, index }: ItineraryCardProps) {
  const intl = useIntl();
  const transfersLabel = intl.formatMessage(
    { id: "transit.itinerary.transfers" },
    { n: itinerary.transfers },
  );
  return (
    <article className="itinerary-card">
      <header className="itinerary-card__header">
        <span className="itinerary-card__label">
          <FormattedMessage
            id="transit.itinerary.option"
            values={{ n: index + 1 }}
          />
        </span>
        <div className="itinerary-card__times">
          <span className="itinerary-card__time">
            {formatDepartureTime(itinerary.startTime)}
          </span>
          <span className="itinerary-card__arrow" aria-hidden="true">
            {RIGHT_ARROW}
          </span>
          <span className="itinerary-card__time">
            {formatDepartureTime(itinerary.endTime)}
          </span>
        </div>
        <div className="itinerary-card__meta">
          <span>{formatDuration(itinerary.duration)}</span>
          <span aria-label={transfersLabel}>
            {itinerary.transfers === 0 ? (
              <FormattedMessage id="transit.itinerary.direct" />
            ) : (
              transfersLabel
            )}
          </span>
          {itinerary.walkDistance > 0 && (
            <span>
              <FormattedMessage
                id="transit.itinerary.walkSuffix"
                values={{
                  distance: formatWalkDistance(itinerary.walkDistance),
                }}
              />
            </span>
          )}
        </div>
      </header>
      <div className="itinerary-card__legs">
        {itinerary.legs.map((leg, i) => (
          <ItineraryLeg key={`${leg.mode}-${leg.startTime}-${i}`} leg={leg} />
        ))}
      </div>
    </article>
  );
}
