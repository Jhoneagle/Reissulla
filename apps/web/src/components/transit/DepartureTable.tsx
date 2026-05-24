import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { TransitSubStop } from "@reissulla/shared";
import { useDepartures, useRecordRecentStop } from "../../hooks/useTransit";
import {
  vehicleModeLabel,
  formatRelativeTime,
  departureToEpoch,
} from "../../lib/transit-utils";
import { useAuthStore } from "../../stores/auth";
import { DepartureRow } from "./DepartureRow";
import { PinButton } from "./PinButton";

interface DepartureTableProps {
  /** GTFS id (stop or station) — drives pin and recent-stops tracking. */
  stopId: string;
  stopName: string;
  vehicleMode: string | null;
  subStops: TransitSubStop[];
  isStation?: boolean;
  stationId?: string;
}

function subStopLabel(ss: TransitSubStop): string {
  if (ss.platformCode) return ss.platformCode;
  if (ss.code) return ss.code;
  return ss.gtfsId.split(":").pop() ?? ss.gtfsId;
}

export function DepartureTable({
  stopId,
  stopName,
  vehicleMode,
  subStops,
  isStation,
  stationId,
}: DepartureTableProps) {
  const intl = useIntl();
  const user = useAuthStore((s) => s.user);
  const recordVisit = useRecordRecentStop();
  const { data, isLoading, isError, dataUpdatedAt, refetch } = useDepartures(
    subStops,
    isStation,
    stationId,
  );

  // Auto-record the visit for the recent-stops list. Fires once per
  // mount per (stopId, name) — the mutation is idempotent (visitCount
  // increments) so a refresh inside the same session counts as a visit.
  useEffect(() => {
    if (!user || !stopId || !stopName) return;
    recordVisit.mutate({
      gtfsId: stopId,
      name: stopName,
      vehicleMode: vehicleMode ?? null,
      isStation: isStation ?? false,
    });
    // recordVisit is stable; mutate is the only thing that should fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, stopId, stopName, vehicleMode, isStation]);
  const prevAnnouncementRef = useRef("");
  const [filterStopId, setFilterStopId] = useState<string | null>(null);

  const result = data?.data;
  const message = result?.message;

  // Track elapsed time since last data update via external store (avoids impure calls in render)
  const subscribe = useCallback(
    (cb: () => void) => {
      if (dataUpdatedAt <= 0) return () => {};
      const id = setInterval(cb, 1000);
      return () => clearInterval(id);
    },
    [dataUpdatedAt],
  );
  const updatedAgo = useSyncExternalStore(subscribe, () =>
    dataUpdatedAt > 0 ? Math.round((Date.now() - dataUpdatedAt) / 1000) : 0,
  );

  const departures = useMemo(() => {
    const all = result?.departures ?? [];
    return filterStopId ? all.filter((d) => d.stopId === filterStopId) : all;
  }, [result?.departures, filterStopId]);

  const showFilter = subStops.length > 1;

  // Build concise announcement for ARIA live region
  const announcement =
    departures.length > 0
      ? `Departures updated, next ${formatRelativeTime(departureToEpoch(departures[0]!.serviceDay, departures[0]!.realtimeDeparture))}`
      : "";

  // Only announce when the text actually changes
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  useEffect(() => {
    if (announcement !== "" && announcement !== prevAnnouncementRef.current) {
      prevAnnouncementRef.current = announcement;
      setLiveAnnouncement(announcement);
    }
  }, [announcement]);

  return (
    <div className="departure-table-wrapper">
      <div className="departure-table__header">
        <h3 className="departure-table__stop-name">{stopName}</h3>
        <div className="departure-table__meta">
          {vehicleMode && (
            <span className="departure-table__mode">
              {vehicleModeLabel(vehicleMode)}
            </span>
          )}
          <PinButton
            stop={{
              gtfsId: stopId,
              name: stopName,
              vehicleMode,
              isStation: isStation ?? false,
            }}
          />
        </div>
      </div>

      {showFilter && (
        <div className="departure-table__filter">
          <label
            htmlFor="platform-filter"
            className="departure-table__filter-label"
          >
            <FormattedMessage id="transit.depart.filter.platform" />
          </label>
          <select
            id="platform-filter"
            value={filterStopId ?? ""}
            onChange={(e) => setFilterStopId(e.target.value || null)}
            className="departure-table__filter-select"
          >
            <option value="">
              {intl.formatMessage({ id: "transit.depart.filter.allPlatforms" })}
            </option>
            {subStops.map((ss) => (
              <option key={ss.gtfsId} value={ss.gtfsId}>
                {subStopLabel(ss)}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div className="departure-table__skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="departure-skel-row">
              <div
                className="skel"
                style={{ width: "3rem", height: "1.25rem" }}
              />
              <div className="skel" style={{ width: "8rem", height: "1rem" }} />
              <div className="skel" style={{ width: "4rem", height: "1rem" }} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="departure-table__error">
          <p>
            <FormattedMessage id="transit.depart.unavailable" />
          </p>
          <button type="button" className="retry-btn" onClick={() => refetch()}>
            <FormattedMessage id="transit.depart.retry" />
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
          <p>
            <FormattedMessage id="transit.depart.empty.noUpcoming" />
          </p>
        </div>
      )}

      {departures.length > 0 && (
        <>
          <table className="departure-table">
            <caption className="visually-hidden">
              <FormattedMessage
                id="transit.depart.caption"
                values={{ stopName, count: departures.length }}
              />
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <FormattedMessage id="transit.depart.column.line" />
                </th>
                <th scope="col">
                  <FormattedMessage id="transit.depart.column.destination" />
                </th>
                {showFilter && !filterStopId && (
                  <th scope="col">
                    <FormattedMessage id="transit.depart.column.platform" />
                  </th>
                )}
                <th scope="col">
                  <FormattedMessage id="transit.depart.column.departs" />
                </th>
                <th scope="col">
                  <span className="visually-hidden">
                    <FormattedMessage id="transit.depart.column.status" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {departures.map((dep, i) => (
                <DepartureRow
                  key={`${dep.routeShortName}-${dep.serviceDay}-${dep.scheduledDeparture}-${i}`}
                  departure={dep}
                  showPlatform={showFilter && !filterStopId}
                />
              ))}
            </tbody>
          </table>

          {dataUpdatedAt > 0 && (
            <p className="departure-table__timestamp">
              <FormattedMessage
                id="transit.depart.updatedAgo"
                values={{ seconds: updatedAgo }}
              />
            </p>
          )}
        </>
      )}

      <div aria-live="polite" className="visually-hidden">
        {liveAnnouncement}
      </div>
    </div>
  );
}
