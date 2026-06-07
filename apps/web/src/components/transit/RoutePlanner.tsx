import { useState, useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  DEFAULT_PLAN_PREFERENCES,
  type GeocodingResult,
  type SavedLocation,
  type TransitMode,
} from "@reissulla/shared";
import { LocationSearch } from "../LocationSearch";
import { useRoutePlan } from "../../hooks/useTransit";
import { useSavedLocations } from "../../hooks/useSavedLocations";
import { ItineraryCard } from "./ItineraryCard";
import { PlannerControls, type PlannerControlsValue } from "./PlannerControls";

const DEFAULT_MODES: TransitMode[] = ["BUS", "TRAM", "RAIL", "SUBWAY", "FERRY"];
const SWAP_GLYPH = "⇅";
const HOME_GLYPH = "⌂";

const DEFAULT_CONTROLS: PlannerControlsValue = {
  dateTime: undefined,
  arriveBy: false,
  modes: DEFAULT_MODES,
  preference: "fastest",
  planPreferences: DEFAULT_PLAN_PREFERENCES,
};

interface RoutePlannerProps {
  initialOrigin?: GeocodingResult | null;
  initialDestination?: GeocodingResult | null;
  initialControls?: Partial<PlannerControlsValue>;
}

function savedLocationToResult(loc: SavedLocation): GeocodingResult {
  return {
    placeId: `saved:${loc.id}`,
    name: loc.name,
    displayName: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    type: "saved-location",
    importance: 1,
  };
}

function homeLocation(
  locations: SavedLocation[] | undefined,
): SavedLocation | null {
  if (!locations) return null;
  return locations.find((l) => l.category === "home") ?? null;
}

export function RoutePlanner({
  initialOrigin = null,
  initialDestination = null,
  initialControls,
}: RoutePlannerProps = {}) {
  const intl = useIntl();
  const [origin, setOrigin] = useState<GeocodingResult | null>(initialOrigin);
  const [destination, setDestination] = useState<GeocodingResult | null>(
    initialDestination,
  );
  const [controls, setControls] = useState<PlannerControlsValue>({
    ...DEFAULT_CONTROLS,
    ...initialControls,
    planPreferences: {
      ...DEFAULT_CONTROLS.planPreferences,
      ...(initialControls?.planPreferences ?? {}),
    },
  });

  const savedLocations = useSavedLocations();
  const home = homeLocation(savedLocations.data?.data);

  const handleOriginSelect = useCallback(
    (result: GeocodingResult) => setOrigin(result),
    [],
  );
  const handleDestinationSelect = useCallback(
    (result: GeocodingResult) => setDestination(result),
    [],
  );

  const handleSwap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const handleGetMeHome = useCallback(() => {
    if (!home) return;
    setDestination(savedLocationToResult(home));
  }, [home]);

  const planInput = useMemo(() => {
    if (!origin || !destination) return null;
    return {
      query: {
        from: { lat: origin.latitude, lon: origin.longitude },
        to: { lat: destination.latitude, lon: destination.longitude },
        dateTime: controls.dateTime,
        arriveBy: controls.arriveBy,
        preference: controls.preference,
        modes: controls.modes,
        planPreferences: controls.planPreferences,
      },
      numItineraries: 3,
      // The planner card surfaces the weather strip; share links opt out
      // so the read endpoint stays light.
      weather: true,
    };
  }, [origin, destination, controls]);

  const plan = useRoutePlan(planInput);
  const result = plan.data?.data;
  const itineraries = result?.itineraries ?? [];
  const message = result?.message;
  const appliedFlags = itineraries[0]?.appliedPersonaFlags;

  return (
    <div className="route-planner">
      <div className="route-planner__form">
        <div className="route-planner__field">
          <label htmlFor="transit-from" className="route-planner__label">
            <FormattedMessage id="transit.plan.from" />
          </label>
          <LocationSearch id="transit-from" onSelect={handleOriginSelect} />
        </div>
        <div className="route-planner__swap">
          <button
            type="button"
            className="btn btn--ghost btn--sm route-planner__swap-button"
            onClick={handleSwap}
            disabled={!origin && !destination}
            aria-label={intl.formatMessage({ id: "transit.plan.swap.aria" })}
          >
            <span aria-hidden="true">{SWAP_GLYPH}</span>
            <FormattedMessage id="transit.plan.swap.label" />
          </button>
        </div>
        <div className="route-planner__field">
          <label htmlFor="transit-to" className="route-planner__label">
            <FormattedMessage id="transit.plan.to" />
          </label>
          <LocationSearch id="transit-to" onSelect={handleDestinationSelect} />
        </div>
        {home && (
          <button
            type="button"
            className="btn btn--ghost btn--sm route-planner__home-pill"
            onClick={handleGetMeHome}
          >
            <span aria-hidden="true">{HOME_GLYPH}</span>
            <FormattedMessage id="transit.plan.getMeHome" />
          </button>
        )}
      </div>

      <PlannerControls value={controls} onChange={setControls} />

      {plan.isLoading && (
        <div className="route-planner__loading">
          <div className="itinerary-skel">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="itinerary-skel__card">
                <div
                  className="skel"
                  style={{ width: "60%", height: "1.25rem" }}
                />
                <div
                  className="skel"
                  style={{
                    width: "40%",
                    height: "0.875rem",
                    marginTop: "0.5rem",
                  }}
                />
                <div
                  className="skel"
                  style={{
                    width: "80%",
                    height: "0.875rem",
                    marginTop: "0.375rem",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.isError && (
        <div className="route-planner__error">
          <p>
            <FormattedMessage id="transit.plan.unavailable" />
          </p>
          <button
            type="button"
            className="retry-btn"
            onClick={() => plan.refetch()}
          >
            <FormattedMessage id="transit.plan.retry" />
          </button>
        </div>
      )}

      {!plan.isLoading &&
        !plan.isError &&
        message &&
        itineraries.length === 0 && (
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
          <p>
            <FormattedMessage id="transit.plan.empty.choose" />
          </p>
        </div>
      )}

      {itineraries.length > 0 && (
        <>
          {appliedFlags &&
            (appliedFlags.wheelchair ||
              appliedFlags.stroller ||
              appliedFlags.lowFloor) && (
              <div
                className="route-planner__applied-flags"
                role="status"
                aria-live="polite"
              >
                {appliedFlags.wheelchair && (
                  <span className="planner-flag-tag planner-flag-tag--wheelchair">
                    <FormattedMessage id="transit.plan.applied.wheelchair" />
                  </span>
                )}
                {appliedFlags.stroller && (
                  <span className="planner-flag-tag planner-flag-tag--stroller">
                    <FormattedMessage id="transit.plan.applied.stroller" />
                  </span>
                )}
                {appliedFlags.lowFloor && (
                  <span className="planner-flag-tag planner-flag-tag--lowfloor">
                    <FormattedMessage id="transit.plan.applied.lowFloor" />
                  </span>
                )}
              </div>
            )}
          <div className="route-planner__results">
            {itineraries.map((it, i) => (
              <ItineraryCard
                key={`${it.startTime}-${it.endTime}-${i}`}
                itinerary={it}
                index={i}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
