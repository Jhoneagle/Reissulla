import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { useSearchParams } from "react-router";
import type { TransitStop } from "@reissulla/shared";
import { usePinnedStops } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { StopSearch } from "./StopSearch";
import { DepartureTable } from "./DepartureTable";
import { RecentStopsList } from "./RecentStopsList";

export function DepartureBoard() {
  const [selectedStop, setSelectedStop] = useState<TransitStop | null>(null);
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const { data: pinnedData } = usePinnedStops(Boolean(user));

  // Deep-link: ?stopId=…&isStation=1 from the dashboard pinned-stops card
  // pre-populates the selection. Look up the pin row for a name and mode,
  // falling back to a synthetic entry if the pin has rotated since.
  useEffect(() => {
    const stopId = params.get("stopId");
    if (!stopId) return;
    if (selectedStop?.gtfsId === stopId) return;
    const pin = pinnedData?.data.find((p) => p.gtfsId === stopId);
    const isStation = params.get("isStation") === "1";
    setSelectedStop({
      gtfsId: stopId,
      name: pin?.name ?? stopId,
      code: null,
      lat: 0,
      lon: 0,
      vehicleMode: pin?.vehicleMode ?? null,
      platformCode: null,
      isStation: pin?.isStation ?? isStation,
      subStops: [
        {
          gtfsId: stopId,
          code: null,
          platformCode: null,
          vehicleMode: pin?.vehicleMode ?? null,
        },
      ],
    });
    // Drop the params from the URL so a refresh does not re-trigger the
    // deep-link override after the user picks something else.
    const next = new URLSearchParams(params);
    next.delete("stopId");
    next.delete("isStation");
    setParams(next, { replace: true });
  }, [params, pinnedData, selectedStop, setParams]);

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
