import { useRef, useEffect } from "react";
import { useDepartures } from "../../hooks/useTransit";
import { vehicleModeLabel, formatRelativeTime, departureToEpoch } from "../../lib/transit-utils";
import { DepartureRow } from "./DepartureRow";

interface DepartureTableProps {
  stopId: string;
  stopName: string;
  stopCode: string | null;
  vehicleMode: string | null;
  vehicleModes?: string[];
  isStation?: boolean;
}

export function DepartureTable({
  stopId,
  stopName,
  stopCode,
  vehicleMode,
  vehicleModes,
  isStation,
}: DepartureTableProps) {
  const { data, isLoading, isError, dataUpdatedAt, refetch } =
    useDepartures(stopId, isStation);
  const prevAnnouncementRef = useRef("");

  const result = data?.data;
  const departures = result?.departures ?? [];
  const message = result?.message;

  // Build concise announcement for ARIA live region
  const announcement =
    departures.length > 0
      ? `Departures updated, next ${formatRelativeTime(departureToEpoch(departures[0]!.serviceDay, departures[0]!.realtimeDeparture))}`
      : "";

  // Only announce when the text actually changes
  const shouldAnnounce =
    announcement !== "" && announcement !== prevAnnouncementRef.current;
  useEffect(() => {
    if (shouldAnnounce) {
      prevAnnouncementRef.current = announcement;
    }
  }, [shouldAnnounce, announcement]);

  return (
    <div className="departure-table-wrapper">
      <div className="departure-table__header">
        <h3 className="departure-table__stop-name">{stopName}</h3>
        <div className="departure-table__meta">
          {stopCode && <span className="departure-table__code">{stopCode}</span>}
          {vehicleModes && vehicleModes.length > 0
            ? vehicleModes.map((m) => (
                <span key={m} className="departure-table__mode">
                  {vehicleModeLabel(m)}
                </span>
              ))
            : vehicleMode && (
                <span className="departure-table__mode">
                  {vehicleModeLabel(vehicleMode)}
                </span>
              )}
        </div>
      </div>

      {isLoading && (
        <div className="departure-table__skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="departure-skel-row">
              <div className="skel" style={{ width: "3rem", height: "1.25rem" }} />
              <div className="skel" style={{ width: "8rem", height: "1rem" }} />
              <div className="skel" style={{ width: "4rem", height: "1rem" }} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="departure-table__error">
          <p>Departure data temporarily unavailable</p>
          <button type="button" className="retry-btn" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && message && departures.length === 0 && (
        <div className="departure-table__empty">
          <p>{message}</p>
        </div>
      )}

      {!isLoading && !isError && departures.length === 0 && !message && (
        <div className="departure-table__empty">
          <p>No upcoming departures</p>
        </div>
      )}

      {departures.length > 0 && (
        <>
          <table className="departure-table">
            <caption className="visually-hidden">
              Departures from {stopName} — {departures.length} upcoming
            </caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Destination</th>
                <th scope="col">Departs</th>
                <th scope="col">
                  <span className="visually-hidden">Status</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {departures.map((dep, i) => (
                <DepartureRow
                  key={`${dep.routeShortName}-${dep.serviceDay}-${dep.scheduledDeparture}-${i}`}
                  departure={dep}
                />
              ))}
            </tbody>
          </table>

          {dataUpdatedAt > 0 && (
            <p className="departure-table__timestamp">
              Updated {Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago
            </p>
          )}
        </>
      )}

      <div aria-live="polite" className="visually-hidden">
        {shouldAnnounce ? announcement : ""}
      </div>
    </div>
  );
}
