import { useCallback, useState } from "react";
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

/**
 * Filter slice owned by DepartureTable — listed here so a stop change
 * can clear them (they're scoped to the previous stop).
 */
const FILTER_PARAM_KEYS = [
  "mode",
  "at",
  "lineFilter",
  "direction",
  "lowFloor",
  "platform",
] as const;

export function DepartureBoard() {
  // The URL is the source of truth for the selected stop (so back from
  // the trip-detail page restores both stop and filters). `useState`
  // tracks a richer TransitStop object — name / vehicleMode / subStops
  // come from the search picker, not the URL.
  const [params, setParams] = useSearchParams();
  const [selectedStop, setSelectedStop] = useState<TransitStop | null>(() =>
    stopFromQuery(params),
  );

  const updateStopParams = useCallback(
    (stop: TransitStop | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (stop) {
          next.set("stopId", stop.gtfsId);
          if (stop.isStation) next.set("isStation", "1");
          else next.delete("isStation");
        } else {
          next.delete("stopId");
          next.delete("isStation");
        }
        // Stop change resets the filter slice: the filter values are
        // scoped to the previous stop's lines / platforms.
        for (const key of FILTER_PARAM_KEYS) next.delete(key);
        return next;
      });
    },
    [setParams],
  );

  const onSelectStop = useCallback(
    (stop: TransitStop | null) => {
      setSelectedStop(stop);
      updateStopParams(stop);
    },
    [updateStopParams],
  );

  return (
    <div className="departure-board">
      <StopSearch onSelect={onSelectStop} />

      {!selectedStop && <RecentStopsList onSelect={onSelectStop} />}

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
          wheelchairBoarding={selectedStop.wheelchairBoarding}
        />
      )}
    </div>
  );
}
