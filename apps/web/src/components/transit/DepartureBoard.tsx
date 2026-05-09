import { useState } from "react";
import type { TransitStop } from "@reissulla/shared";
import { StopSearch } from "./StopSearch";
import { DepartureTable } from "./DepartureTable";

export function DepartureBoard() {
  const [selectedStop, setSelectedStop] = useState<TransitStop | null>(null);

  return (
    <div className="departure-board">
      <StopSearch onSelect={setSelectedStop} />

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
          <p>Search for a transit stop to see departures.</p>
        </div>
      )}

      {selectedStop && (
        <DepartureTable
          key={`${selectedStop.gtfsId}-${selectedStop.vehicleMode}`}
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
