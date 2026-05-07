import { useState, useCallback } from "react";
import type { GeocodingResult } from "@reissulla/shared";
import { LocationSearch } from "../LocationSearch";
import { useRoutePlan } from "../../hooks/useTransit";
import { ItineraryCard } from "./ItineraryCard";

export function RoutePlanner() {
  const [origin, setOrigin] = useState<GeocodingResult | null>(null);
  const [destination, setDestination] = useState<GeocodingResult | null>(null);

  const handleOriginSelect = useCallback(
    (result: GeocodingResult) => setOrigin(result),
    [],
  );
  const handleDestinationSelect = useCallback(
    (result: GeocodingResult) => setDestination(result),
    [],
  );

  const plan = useRoutePlan(
    origin?.latitude ?? null,
    origin?.longitude ?? null,
    destination?.latitude ?? null,
    destination?.longitude ?? null,
  );

  const result = plan.data?.data;
  const itineraries = result?.itineraries ?? [];
  const message = result?.message;

  return (
    <div className="route-planner">
      <div className="route-planner__form">
        <div className="route-planner__field">
          <label htmlFor="transit-from" className="route-planner__label">
            From
          </label>
          <LocationSearch id="transit-from" onSelect={handleOriginSelect} />
        </div>
        <div className="route-planner__field">
          <label htmlFor="transit-to" className="route-planner__label">
            To
          </label>
          <LocationSearch id="transit-to" onSelect={handleDestinationSelect} />
        </div>
      </div>

      {plan.isLoading && (
        <div className="route-planner__loading">
          <div className="itinerary-skel">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="itinerary-skel__card">
                <div className="skel" style={{ width: "60%", height: "1.25rem" }} />
                <div className="skel" style={{ width: "40%", height: "0.875rem", marginTop: "0.5rem" }} />
                <div className="skel" style={{ width: "80%", height: "0.875rem", marginTop: "0.375rem" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.isError && (
        <div className="route-planner__error">
          <p>Route planning temporarily unavailable</p>
          <button type="button" className="retry-btn" onClick={() => plan.refetch()}>
            Try again
          </button>
        </div>
      )}

      {!plan.isLoading && !plan.isError && message && itineraries.length === 0 && (
        <div className="route-planner__empty">
          <p>{message}</p>
        </div>
      )}

      {!origin && !destination && !plan.isLoading && (
        <div className="route-planner__hint">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>Choose origin and destination to plan a route.</p>
        </div>
      )}

      {itineraries.length > 0 && (
        <div className="route-planner__results">
          {itineraries.map((it, i) => (
            <ItineraryCard
              key={`${it.startTime}-${it.endTime}-${i}`}
              itinerary={it}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
