import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { useSearchParams } from "react-router";
import type { TransitStop } from "@reissulla/shared";
import { StopSearch } from "./StopSearch";
import { DepartureTable } from "./DepartureTable";
import { RecentStopsList } from "./RecentStopsList";

/**
 * Build a synthetic TransitStop from a `?stopId=…&isStation=…` deep-link.
 * Name + vehicleMode come up empty until the user picks a real result; the
 * dashboard card's link still works because `DepartureTable` re-fetches
 * by gtfsId rather than relying on the synthetic name.
 */
function stopFromQuery(params: URLSearchParams): TransitStop | null {
  const stopId = params.get("stopId");
  if (!stopId) return null;
  const isStation = params.get("isStation") === "1";
  return {
    gtfsId: stopId,
    name: stopId,
    code: null,
    lat: 0,
    lon: 0,
    vehicleMode: null,
    platformCode: null,
    isStation,
    subStops: [
      {
        gtfsId: stopId,
        code: null,
        platformCode: null,
        vehicleMode: null,
      },
    ],
  };
}

export function DepartureBoard() {
  // Read the deep-link params once at mount via the useState lazy
  // initializer — keeps the URL → state hop out of a useEffect (which
  // would trigger cascading renders and trip the react-hooks rule).
  // After mount, normal user navigation drives selectedStop and the
  // params are not re-consulted.
  const [params] = useSearchParams();
  const [selectedStop, setSelectedStop] = useState<TransitStop | null>(() =>
    stopFromQuery(params),
  );

  return (
    <div className="departure-board">
      <StopSearch onSelect={setSelectedStop} />

      {!selectedStop && <RecentStopsList onSelect={setSelectedStop} />}

      {!selectedStop && (
        <div className="departure-board__empty">
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
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p>
            <FormattedMessage id="transit.depart.empty.searchHint" />
          </p>
        </div>
      )}

      {selectedStop && (
        <DepartureTable
          key={`${selectedStop.gtfsId}-${selectedStop.vehicleMode}`}
          stopId={selectedStop.gtfsId}
          stopName={selectedStop.name}
          vehicleMode={selectedStop.vehicleMode}
          subStops={selectedStop.subStops ?? []}
          isStation={selectedStop.isStation}
          stationId={selectedStop.isStation ? selectedStop.gtfsId : undefined}
        />
      )}
    </div>
  );
}
