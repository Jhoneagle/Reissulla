import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useSearchParams } from "react-router";
import {
  formatDeparture,
  serviceDayFromUnix,
  type TransitSubStop,
  type WheelchairBoarding,
} from "@reissulla/shared";
import type {
  ArrivalDepartureMode,
  DeparturesOptions,
} from "@reissulla/api-client";
import { useFirstLast, useRecordRecentStop } from "../../hooks/useTransit";
import { useLiveDepartures } from "../../hooks/useLiveDepartures";
import { StopAlertChips } from "./StopAlertChips";
import { useRefreshChoice } from "../../hooks/useRefreshChoice";
import {
  vehicleModeLabel,
  vehicleModeToken,
  formatRelativeTime,
  formatNextDeparture,
  departureToEpoch,
} from "../../lib/transit-utils";
import { useAuthStore } from "../../stores/auth";
import { DepartureRow } from "./DepartureRow";
import { PinButton } from "./PinButton";
import { TimePickerDialog } from "./TimePickerDialog";
import { DepartureFilters, type AdvancedFilterState } from "./DepartureFilters";
import { StopAccessibilityDisclosure } from "./StopAccessibilityDisclosure";
import { DepartureDirectionSplit } from "./DepartureDirectionSplit";
import { LiveIndicator } from "./LiveIndicator";
import { RefreshTicker } from "./RefreshTicker";
import { useLiveAnnouncer } from "../LiveAnnouncerProvider";

interface DepartureTableProps {
  /** GTFS id (stop or station) — drives pin and recent-stops tracking. */
  stopId: string;
  stopName: string;
  vehicleMode: string | null;
  subStops: TransitSubStop[];
  isStation?: boolean;
  stationId?: string;
  /** Feed-confirmed accessibility flag — backs the A11Y-20 disclosure. */
  wheelchairBoarding?: WheelchairBoarding;
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

/**
 * URL keys for the persisted filter slice. Kept short for readability in
 * the address bar; the back-navigation acceptance gate ("filtered
 * departure-board state restored") relies on these surviving a
 * round-trip through history.
 */
const URL_KEYS = {
  mode: "mode",
  at: "at",
  lineFilter: "lineFilter",
  direction: "direction",
  lowFloor: "lowFloor",
  platform: "platform",
} as const;

function readMode(params: URLSearchParams): ArrivalDepartureMode {
  const raw = params.get(URL_KEYS.mode);
  return raw === "arrivals" || raw === "both" ? raw : "departures";
}

function readAt(params: URLSearchParams): number | undefined {
  const raw = params.get(URL_KEYS.at);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function readAdvanced(params: URLSearchParams): AdvancedFilterState {
  const lineRaw = params.get(URL_KEYS.lineFilter);
  return {
    lineFilter: lineRaw ? lineRaw.split(",").filter(Boolean) : [],
    directionFilter: params.get(URL_KEYS.direction) ?? "",
    lowFloorOnly: params.get(URL_KEYS.lowFloor) === "1",
  };
}

export function DepartureTable({
  stopId,
  stopName,
  vehicleMode,
  subStops,
  isStation,
  stationId,
  wheelchairBoarding,
}: DepartureTableProps) {
  const intl = useIntl();
  const user = useAuthStore((s) => s.user);
  const recordVisit = useRecordRecentStop();

  // Filter state lives in the URL so back-navigation from the trip
  // detail page restores the user's filter context. Each update uses
  // `replace: true` so churning through filters doesn't pollute browser
  // history — only stop selection and trip drill-down add new entries.
  const [params, setParams] = useSearchParams();
  const at = readAt(params);
  const mode = readMode(params);
  const filterStopId = params.get(URL_KEYS.platform) || null;
  const advanced = readAdvanced(params);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setAt = useCallback(
    (next: number | undefined) =>
      updateParams({
        [URL_KEYS.at]: next !== undefined ? String(next) : null,
      }),
    [updateParams],
  );
  const setMode = useCallback(
    (next: ArrivalDepartureMode) =>
      updateParams({
        [URL_KEYS.mode]: next === "departures" ? null : next,
      }),
    [updateParams],
  );
  const setFilterStopId = useCallback(
    (next: string | null) => updateParams({ [URL_KEYS.platform]: next }),
    [updateParams],
  );
  const setAdvanced = useCallback(
    (next: AdvancedFilterState) =>
      updateParams({
        [URL_KEYS.lineFilter]:
          next.lineFilter.length > 0 ? next.lineFilter.join(",") : null,
        [URL_KEYS.direction]: next.directionFilter.trim() || null,
        [URL_KEYS.lowFloor]: next.lowFloorOnly ? "1" : null,
      }),
    [updateParams],
  );

  const clearAllFilters = useCallback(() => {
    updateParams({
      [URL_KEYS.platform]: null,
      [URL_KEYS.lineFilter]: null,
      [URL_KEYS.direction]: null,
      [URL_KEYS.lowFloor]: null,
      [URL_KEYS.at]: null,
    });
  }, [updateParams]);

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

  const { choice: refreshChoice, setChoice: setRefreshChoice } =
    useRefreshChoice();

  const {
    data,
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
    source: liveSource,
    indicator: liveIndicator,
    sseStatus,
    sseAttempted,
  } = useLiveDepartures(
    subStops,
    isStation,
    stationId,
    departureOptions,
    refreshChoice,
  );

  // "Live updates unavailable here — falling back to 30 s" inline notice:
  // user picked Live, the SSE pipe was attempted, but the connection is
  // currently closed (most often the realtimeSse env flag is off, but
  // also when SSE has fully disconnected mid-session).
  const showLiveUnavailable =
    refreshChoice === "live" && sseAttempted && sseStatus === "closed";
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

  // URL-restore path arrives with vehicleMode=null (stopFromQuery synthesises
  // a TransitStop from ?stopId= alone). Recover the mode from the first
  // departure once the response lands so the masthead tag stays visible
  // after a back-navigation from /transit/trip/:tripId.
  const effectiveVehicleMode =
    vehicleMode ?? result?.departures?.[0]?.vehicleMode ?? null;
  const modeToken = vehicleModeToken(effectiveVehicleMode);
  const firstLastData = firstLast.data?.data;
  const hasFirstLast = Boolean(firstLastData?.first && firstLastData?.last);
  const frequency = result?.frequency;
  const serviceNote = result?.serviceNote;
  const hasActiveFilters =
    filterStopId !== null ||
    advanced.lineFilter.length > 0 ||
    advanced.directionFilter.trim().length > 0 ||
    advanced.lowFloorOnly ||
    at !== undefined;

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

  // The URL-restore path (DepartureBoard.stopFromQuery) seeds `stopName`
  // with the raw gtfsId because the picker hasn't been touched yet — once
  // the departures response lands it carries the real upstream name, which
  // we prefer everywhere so the masthead never reads "digitraffic:HKI:…".
  const displayName = result?.stopName ?? stopName;

  // DEP-13 — announce a boardable vehicle within 60 s of its realtime
  // departure, but only on live (SSE) updates so the REST fallback's coarser
  // ticks don't drive announcements. The announcer enforces the 15 s per-stop
  // floor and coalesces multiple lines into one phrase.
  const announcer = useLiveAnnouncer();
  useEffect(() => {
    if (liveSource !== "sse") return;
    const nowSec = Date.now() / 1000;
    for (const dep of departures) {
      if (dep.canBoard === false) continue;
      const etaSeconds =
        departureToEpoch(dep.serviceDay, dep.realtimeDeparture) - nowSec;
      if (etaSeconds < 0 || etaSeconds > 60) continue;
      announcer.announce({
        stopId,
        stopName: displayName,
        routeShortName: dep.routeShortName,
        headsign: dep.headsign,
        etaSeconds,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departures, liveSource, stopId, displayName]);

  return (
    <section className="departure-board-section" aria-labelledby="dep-title">
      <header className="departure-masthead">
        <div className="departure-masthead__title-row">
          <h3 id="dep-title" className="departure-masthead__title">
            {displayName}
          </h3>
          {effectiveVehicleMode && (
            <span className={`mode-tag mode-${modeToken}`}>
              {vehicleModeLabel(effectiveVehicleMode)}
            </span>
          )}
          <LiveIndicator state={liveIndicator} />
          <div className="departure-masthead__title-spacer" />
          <PinButton
            stop={{
              gtfsId: stopId,
              name: displayName,
              vehicleMode: effectiveVehicleMode,
              isStation: isStation ?? false,
            }}
          />
          <RefreshTicker
            choice={refreshChoice}
            onChoiceChange={setRefreshChoice}
            showLiveUnavailable={showLiveUnavailable}
          />
        </div>

        <StopAlertChips stopId={stopId} departures={result?.departures ?? []} />

        {frequency && (
          <p className="departure-masthead__frequency">
            {frequency.regime === "dense" && (
              <FormattedMessage
                id="transit.depart.frequency.dense"
                values={{ count: frequency.nextHourCount }}
              />
            )}
            {frequency.regime === "moderate" && frequency.avgIntervalMin && (
              <FormattedMessage
                id="transit.depart.frequency.moderate"
                values={{ avg: frequency.avgIntervalMin }}
              />
            )}
            {frequency.regime === "moderate" && !frequency.avgIntervalMin && (
              <FormattedMessage
                id="transit.depart.frequency.moderateCount"
                values={{ count: frequency.nextHourCount }}
              />
            )}
            {frequency.regime === "sparse" && frequency.nextDepartureUnix && (
              <FormattedMessage
                id="transit.depart.frequency.sparseNext"
                values={{
                  next: formatNextDeparture(frequency.nextDepartureUnix, "fi"),
                }}
              />
            )}
            {frequency.regime === "sparse" && !frequency.nextDepartureUnix && (
              <FormattedMessage id="transit.depart.frequency.sparseQuiet" />
            )}
            {serviceNote && (
              <>
                <span className="departure-masthead__sep" aria-hidden="true" />
                <span>{serviceNote}</span>
              </>
            )}
          </p>
        )}

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

      <StopAccessibilityDisclosure wheelchairBoarding={wheelchairBoarding} />

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
        <div className="departure-list__skeleton" aria-hidden="true">
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
        <div className="departure-list__error">
          <p>
            <FormattedMessage id="transit.depart.unavailable" />
          </p>
          <button type="button" className="retry-btn" onClick={() => refetch()}>
            <FormattedMessage id="transit.depart.retry" />
          </button>
        </div>
      )}

      {!isLoading && !isError && message && departures.length === 0 && (
        <div className="departure-list__empty">
          <p>{message}</p>
        </div>
      )}

      {!isLoading &&
        !isError &&
        departures.length === 0 &&
        !message &&
        hasActiveFilters && (
          <div className="departure-list__empty">
            <p>
              <FormattedMessage id="transit.depart.empty.filtered" />
            </p>
            <button
              type="button"
              className="btn btn--link"
              onClick={clearAllFilters}
            >
              <FormattedMessage id="transit.depart.empty.clearFilters" />
            </button>
          </div>
        )}

      {!isLoading &&
        !isError &&
        departures.length === 0 &&
        !message &&
        !hasActiveFilters && (
          <div className="departure-list__empty">
            <p>
              <FormattedMessage id="transit.depart.empty.noUpcoming" />
            </p>
          </div>
        )}

      {departures.length > 0 && result?.byDirection && !filterStopId && (
        <>
          <DepartureDirectionSplit
            byDirection={result.byDirection}
            mode={mode}
            stopName={displayName}
          />
          {dataUpdatedAt > 0 && (
            <p className="departure-list__timestamp" aria-live="off">
              <FormattedMessage
                id="transit.depart.updatedAgo"
                values={{ seconds: updatedAgo }}
              />
            </p>
          )}
        </>
      )}

      {departures.length > 0 &&
        !(result?.byDirection && !filterStopId) &&
        (() => {
          const showPlatformCol = showPlatformFilter && !filterStopId;
          const platformMod = showPlatformCol
            ? " departure-list--has-platform"
            : "";
          return (
            <>
              <div
                className={`departure-list__header${platformMod}`}
                aria-hidden="true"
              >
                <span>
                  <FormattedMessage id="transit.depart.column.line" />
                </span>
                <span>
                  <FormattedMessage id="transit.depart.column.destination" />
                </span>
                {showPlatformCol && (
                  <span>
                    <FormattedMessage id="transit.depart.column.platform" />
                  </span>
                )}
                <span className="departure-list__header-time">
                  <FormattedMessage id={columnHeadingKey} />
                </span>
                <span />
              </div>
              <ol
                className={`departure-list${platformMod}`}
                aria-label={intl.formatMessage(
                  { id: "transit.depart.caption" },
                  { stopName: displayName, count: departures.length },
                )}
              >
                {departures.map((dep, i) => (
                  <DepartureRow
                    key={`${dep.routeShortName}-${dep.serviceDay}-${dep.scheduledDeparture}-${i}`}
                    departure={dep}
                    mode={mode}
                    showPlatform={showPlatformCol}
                  />
                ))}
              </ol>

              {dataUpdatedAt > 0 && (
                <p className="departure-list__timestamp">
                  <FormattedMessage
                    id="transit.depart.updatedAgo"
                    values={{ seconds: updatedAgo }}
                  />
                </p>
              )}
            </>
          );
        })()}

      <div aria-live="polite" className="visually-hidden">
        {liveAnnouncement}
      </div>
    </section>
  );
}
