import type { TransitItinerary } from "@reissulla/shared";
import {
  formatDepartureTime,
  formatDuration,
  formatWalkDistance,
} from "../../lib/transit-utils";
import { ItineraryLeg } from "./ItineraryLeg";

interface ItineraryCardProps {
  itinerary: TransitItinerary;
  index: number;
}

export function ItineraryCard({ itinerary, index }: ItineraryCardProps) {
  return (
    <article className="itinerary-card">
      <header className="itinerary-card__header">
        <span className="itinerary-card__label">Option {index + 1}</span>
        <div className="itinerary-card__times">
          <span className="itinerary-card__time">
            {formatDepartureTime(itinerary.startTime)}
          </span>
          <span className="itinerary-card__arrow" aria-hidden="true">
            →
          </span>
          <span className="itinerary-card__time">
            {formatDepartureTime(itinerary.endTime)}
          </span>
        </div>
        <div className="itinerary-card__meta">
          <span>{formatDuration(itinerary.duration)}</span>
          <span aria-label={`${itinerary.transfers} transfer${itinerary.transfers !== 1 ? "s" : ""}`}>
            {itinerary.transfers === 0
              ? "Direct"
              : `${itinerary.transfers} transfer${itinerary.transfers !== 1 ? "s" : ""}`}
          </span>
          {itinerary.walkDistance > 0 && (
            <span>{formatWalkDistance(itinerary.walkDistance)} walk</span>
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
