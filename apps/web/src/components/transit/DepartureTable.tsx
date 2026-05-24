import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  formatDeparture,
  serviceDayFromUnix,
  type TransitSubStop,
} from "@reissulla/shared";
import type {
  ArrivalDepartureMode,
  DeparturesOptions,
} from "@reissulla/api-client";
import {
  useDepartures,
  useFirstLast,
  useRecordRecentStop,
} from "../../hooks/useTransit";
import {
  vehicleModeLabel,
  vehicleModeToken,
  formatRelativeTime,
  departureToEpoch,
} from "../../lib/transit-utils";
import { useAuthStore } from "../../stores/auth";
import { DepartureRow } from "./DepartureRow";
import { PinButton } from "./PinButton";
import { TimePickerDialog } from "./TimePickerDialog";
import { DepartureFilters, type AdvancedFilterState } from "./DepartureFilters";

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

function formatHelsinkiClock(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString("fi-FI", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHelsinkiDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("fi-FI", {
    timeZone: "Europe/Helsinki",
    day: "2-digit",
    month: "2-digit",
  });
}

const EMPTY_FILTERS: AdvancedFilterState = {
  lineFilter: [],
  directionFilter: "",
  lowFloorOnly: false,
};

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

  const [at, setAt] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<ArrivalDepartureMode>("departures");
  const [filterStopId, setFilterStopId] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedFilterState>(EMPTY_FILTERS);

  const departureOptions: DeparturesOptions = useMemo(
    () => ({
      at,
      mode,
      lineFilter:
        advanced.lineFilter.length > 0 ? advanced.lineFilter : undefined,
      directionFilter: advanced.directionFilter.trim() || undefined,
      lowFloorOnly: advanced.lowFloorOnly || undefined,
    }),
    [at, mode, advanced],
  );

  const { data, isLoading, isError, dataUpdatedAt, refetch } = useDepartures(
    subStops,
    isStation,
    stationId,
    departureOptions,
  );
  const firstLast = useFirstLast(stopId);

  useEffect(() => {
    if (!user || !stopId || !stopName) return;
    recordVisit.mutate({
      gtfsId: stopId,
      name: stopName,
      vehicleMode: vehicleMode ?? null,
      isStation: isStation ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, stopId, stopName, vehicleMode, isStation]);
  const prevAnnouncementRef = useRef("");

  const result = data?.data;
  const message = result?.message;

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

  const showPlatformFilter = subStops.length > 1;

  const announcement =
    departures.length > 0
      ? `Departures updated, next ${formatRelativeTime(
          departureToEpoch(
            departures[0]!.serviceDay,
            mode === "arrivals"
              ? departures[0]!.realtimeArrival
              : departures[0]!.realtimeDeparture,
          ),
        )}`
      : "";

  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  useEffect(() => {
    if (announcement !== "" && announcement !== prevAnnouncementRef.current) {
      prevAnnouncementRef.current = announcement;
      setLiveAnnouncement(announcement);
    }
  }, [announcement]);

  const modeToken = vehicleModeToken(vehicleMode);
  const firstLastData = firstLast.data?.data;
  const hasFirstLast = Boolean(firstLastData?.first && firstLastData?.last);

  const timeButtonLabel =
    at === undefined
      ? intl.formatMessage({ id: "transit.depart.time.now" })
      : `${formatHelsinkiDate(at)} ${formatHelsinkiClock(at)}`;

  const columnHeadingKey =
    mode === "arrivals"
      ? "transit.depart.column.arrives"
      : mode === "both"
        ? "transit.depart.column.time"
        : "transit.depart.column.departs";

  return (
    <section className="departure-board-section" aria-labelledby="dep-title">
      <header className="departure-masthead">
        <div className="departure-masthead__title-row">
          <h3 id="dep-title" className="departure-masthead__title">
            {stopName}
          </h3>
          {vehicleMode && (
            <span className={`mode-tag mode-${modeToken}`}>
              {vehicleModeLabel(vehicleMode)}
            </span>
          )}
          <div className="departure-masthead__title-spacer" />
          <PinButton
            stop={{
              gtfsId: stopId,
              name: stopName,
              vehicleMode,
              isStation: isStation ?? false,
            }}
          />
        </div>

        {hasFirstLast && (
          <p className="departure-masthead__kicker">
            <FormattedMessage
              id="transit.depart.kicker.firstLast"
              values={{
                first: formatDeparture(
                  serviceDayFromUnix(
                    firstLastData!.first!.serviceDay +
                      firstLastData!.first!.scheduledDeparture,
                  ),
                  "fi",
                ),
                last: formatDeparture(
                  serviceDayFromUnix(
                    firstLastData!.last!.serviceDay +
                      firstLastData!.last!.scheduledDeparture,
                  ),
                  "fi",
                ),
              }}
            />
          </p>
        )}
      </header>

      <div className="departure-controls">
        <div className="departure-controls__primary">
          <button
            type="button"
            className={`departure-controls__time-btn${at !== undefined ? " departure-controls__time-btn--set" : ""}`}
            onClick={() => setTimePickerOpen(true)}
            aria-haspopup="dialog"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            <span>{timeButtonLabel}</span>
          </button>

          <fieldset
            className="departure-controls__segmented"
            aria-label={intl.formatMessage({ id: "transit.depart.mode.label" })}
          >
            <legend className="visually-hidden">
              <FormattedMessage id="transit.depart.mode.label" />
            </legend>
            {(["departures", "arrivals", "both"] as const).map((option) => (
              <label
                key={option}
                className={`departure-controls__seg-item${mode === option ? " departure-controls__seg-item--on" : ""}`}
              >
                <input
                  type="radio"
                  name="dep-mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                />
                <span>
                  <FormattedMessage id={`transit.depart.mode.${option}`} />
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        {showPlatformFilter && (
          <div className="departure-controls__platform">
            <label
              htmlFor="platform-filter"
              className="departure-controls__platform-label"
            >
              <FormattedMessage id="transit.depart.filter.platform" />
            </label>
            <select
              id="platform-filter"
              value={filterStopId ?? ""}
              onChange={(e) => setFilterStopId(e.target.value || null)}
              className="departure-controls__platform-select"
            >
              <option value="">
                {intl.formatMessage({
                  id: "transit.depart.filter.allPlatforms",
                })}
              </option>
              {subStops.map((ss) => (
                <option key={ss.gtfsId} value={ss.gtfsId}>
                  {subStopLabel(ss)}
                </option>
              ))}
            </select>
          </div>
        )}

        <DepartureFilters value={advanced} onChange={setAdvanced} />
      </div>

      <TimePickerDialog
        value={at}
        open={timePickerOpen}
        onChange={setAt}
        onClose={() => setTimePickerOpen(false)}
      />

      {isLoading && (
        <div className="departure-table__skeleton" aria-hidden="true">
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
                {showPlatformFilter && !filterStopId && (
                  <th scope="col">
                    <FormattedMessage id="transit.depart.column.platform" />
                  </th>
                )}
                <th scope="col" className="departure-table__th-time">
                  <FormattedMessage id={columnHeadingKey} />
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
                  mode={mode}
                  showPlatform={showPlatformFilter && !filterStopId}
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
    </section>
  );
}
