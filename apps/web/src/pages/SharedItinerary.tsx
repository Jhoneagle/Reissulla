import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router";
import { useRoutePlan } from "../hooks/useTransit";
import { ItineraryCard } from "../components/transit/ItineraryCard";

interface SharedItineraryFragment {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  dateTime?: number;
}

function parseFragment(hash: string): SharedItineraryFragment | null {
  if (!hash) return null;
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  if (!fromRaw || !toRaw) return null;
  const [fromLatStr, fromLonStr] = fromRaw.split(",");
  const [toLatStr, toLonStr] = toRaw.split(",");
  const fromLat = Number(fromLatStr);
  const fromLon = Number(fromLonStr);
  const toLat = Number(toLatStr);
  const toLon = Number(toLonStr);
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLon) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLon)
  ) {
    return null;
  }
  const at = params.get("at");
  const dateTime = at ? Number(at) : undefined;
  return {
    from: { lat: fromLat, lon: fromLon },
    to: { lat: toLat, lon: toLon },
    dateTime:
      typeof dateTime === "number" && Number.isFinite(dateTime)
        ? dateTime
        : undefined,
  };
}

export function SharedItinerary() {
  const [fragment, setFragment] = useState<SharedItineraryFragment | null>(
    () =>
      typeof window === "undefined"
        ? null
        : parseFragment(window.location.hash),
  );

  useEffect(() => {
    function onHashChange() {
      setFragment(parseFragment(window.location.hash));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const plan = useRoutePlan(
    fragment
      ? {
          query: {
            from: fragment.from,
            to: fragment.to,
            dateTime: fragment.dateTime,
            arriveBy: false,
          },
          numItineraries: 1,
        }
      : null,
  );

  if (!fragment) {
    return (
      <section className="shared-itinerary">
        <h2 className="shared-itinerary__heading">
          <FormattedMessage id="transit.itinerary.share.missingHeading" />
        </h2>
        <p className="shared-itinerary__hint">
          <FormattedMessage id="transit.itinerary.share.missingHint" />
        </p>
        <p>
          <Link
            to="/transit?tab=planner"
            className="btn btn--secondary btn--sm"
          >
            <FormattedMessage id="transit.itinerary.share.openPlanner" />
          </Link>
        </p>
      </section>
    );
  }

  const itineraries = plan.data?.data.itineraries ?? [];
  const first = itineraries[0];

  return (
    <section className="shared-itinerary">
      <h2 className="shared-itinerary__heading">
        <FormattedMessage id="transit.itinerary.share.viewHeading" />
      </h2>
      {plan.isLoading && (
        <p className="shared-itinerary__loading">
          <FormattedMessage id="transit.plan.loading" />
        </p>
      )}
      {plan.isError && (
        <p className="shared-itinerary__error">
          <FormattedMessage id="transit.plan.unavailable" />
        </p>
      )}
      {first && <ItineraryCard itinerary={first} index={0} />}
      {!plan.isLoading && !first && (
        <p className="shared-itinerary__empty">
          <FormattedMessage id="transit.plan.empty.choose" />
        </p>
      )}
      <p className="shared-itinerary__footer">
        <Link to="/transit?tab=planner" className="btn btn--ghost btn--sm">
          <FormattedMessage id="transit.itinerary.share.replan" />
        </Link>
      </p>
    </section>
  );
}
