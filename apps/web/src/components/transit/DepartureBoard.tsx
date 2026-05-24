import { useState } from "react";
import { FormattedMessage } from "react-intl";
import type { TransitStop } from "@reissulla/shared";
import { StopSearch } from "./StopSearch";
import { DepartureTable } from "./DepartureTable";
import { RecentStopsList } from "./RecentStopsList";

export function DepartureBoard() {
  const [selectedStop, setSelectedStop] = useState<TransitStop | null>(null);

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
