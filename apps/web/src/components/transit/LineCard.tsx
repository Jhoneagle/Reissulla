import { useState, useSyncExternalStore } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type {
  DayType,
  DirectionId,
  LineStopDeparture,
  Pattern,
} from "@reissulla/shared";
import { ApiError } from "@reissulla/api-client";
import {
  useFrequency,
  useLine,
  useLineDepartures,
} from "../../hooks/useTransit";
import { vehicleModeToken } from "../../lib/transit-utils";
import { StopList, type StopRowProps } from "./StopList";
import { DirectionToggle } from "./DirectionToggle";
import { FrequencyStrip } from "./FrequencyStrip";
import { LinePinButton } from "./LinePinButton";
import "./StopList/stop-list.css";
import "./line-card.css";

interface LineCardProps {
  gtfsId: string;
  /**
   * Controlled direction. When omitted, the card owns dir state locally.
   */
  direction?: DirectionId;
  onDirectionChange?: (next: DirectionId) => void;
  /** Controlled day-type, same uncontrolled-fallback shape. */
  dayType?: DayType;
  onDayTypeChange?: (next: DayType) => void;
  /** Optional fineprint footer — the page surface renders one. */
  showFineprint?: boolean;
}

export function LineCard({
  gtfsId,
  direction: controlledDir,
  onDirectionChange,
  dayType: controlledDayType,
  onDayTypeChange,
  showFineprint = false,
}: LineCardProps) {
  const intl = useIntl();
  const [localDir, setLocalDir] = useState<DirectionId>(0);
  const [localDayType, setLocalDayType] = useState<DayType>("weekday");
  const direction = controlledDir ?? localDir;
  const dayType = controlledDayType ?? localDayType;
  const handleDirChange = (next: DirectionId) => {
    if (onDirectionChange) onDirectionChange(next);
    else setLocalDir(next);
  };
  const handleDayTypeChange = (next: DayType) => {
    if (onDayTypeChange) onDayTypeChange(next);
    else setLocalDayType(next);
  };

  const lineQuery = useLine(gtfsId);
  const departuresQuery = useLineDepartures(gtfsId, direction);
  const frequencyQuery = useFrequency(gtfsId, dayType, direction);

  if (lineQuery.isLoading) {
    return (
      <div className="line-card line-card--loading" aria-live="polite">
        <div className="line-card__skeleton" aria-hidden="true">
          <div className="skel" style={{ width: "40%", height: "2.5rem" }} />
          <div className="skel" style={{ width: "60%", height: "1.5rem" }} />
        </div>
      </div>
    );
  }

  if (lineQuery.isError) {
    const notFound =
      lineQuery.error instanceof ApiError && lineQuery.error.status === 404;
    return (
      <div className="line-card line-card--error">
        <p>
          <FormattedMessage
            id={notFound ? "transit.line.notFound" : "transit.line.error"}
          />
        </p>
        {!notFound && (
          <button
            type="button"
            className="retry-btn"
            onClick={() => lineQuery.refetch()}
          >
            <FormattedMessage id="transit.line.retry" />
          </button>
        )}
      </div>
    );
  }

  const line = lineQuery.data?.data;
  if (!line || line.patterns.length === 0) {
    return (
      <div className="line-card line-card--empty">
        <p>
          <FormattedMessage id="transit.line.empty" />
        </p>
      </div>
    );
  }

  const pattern = pickPattern(line.patterns, direction);
  if (!pattern) {
    return (
      <div className="line-card line-card--empty">
        <p>
          <FormattedMessage id="transit.line.empty" />
        </p>
      </div>
    );
  }

  const modeToken = vehicleModeToken(line.mode);
  const departures = departuresQuery.data?.data ?? [];
  // Banner heuristic: departures fetched, no stop has an upcoming time.
  // Distinguishes "line out of service right now" (late night, school
  // holiday) from "still loading" or "no stops" — only fires when we have
  // a confirmed empty projection so brief loading states don't flash it.
  const noServiceNow =
    !departuresQuery.isLoading &&
    departures.length > 0 &&
    departures.every((d) => d.nextDepartureUnix == null);

  return (
    <article className={`line-card line-card--mode-${modeToken}`}>
      <header className="line-card__masthead">
        <div className="line-card__masthead-top">
          <p className="line-card__kicker">
            <FormattedMessage id="transit.line.kicker" />
          </p>
          <LinePinButton
            gtfsId={line.gtfsId}
            name={line.shortName}
            vehicleMode={line.mode}
          />
        </div>
        <hr className="line-card__top-rule" />
        <div className="line-card__display">
          <span className="line-card__number">{line.shortName}</span>
          <p className="line-card__headsign">
            <span className="line-card__origin">
              {pattern.stops[0]?.name ?? ""}
            </span>
            <span className="line-card__arrow" aria-hidden="true" />
            <span className="line-card__destination">{pattern.headsign}</span>
          </p>
        </div>
      </header>

      <DirectionToggle
        patterns={line.patterns}
        active={direction}
        onChange={handleDirChange}
      />

      <FrequencyStrip
        bands={frequencyQuery.data?.data ?? []}
        modeToken={modeToken}
        dayType={dayType}
        onDayTypeChange={handleDayTypeChange}
      />

      {noServiceNow && (
        <p className="line-card__no-service" role="status">
          <FormattedMessage id="transit.line.stops.noServiceNow" />
        </p>
      )}

      <LineStopRows
        stops={pattern.stops}
        departures={departures}
        modeToken={modeToken}
        intl={intl}
      />

      {showFineprint && (
        <footer className="line-card__fineprint">
          <p>
            <FormattedMessage
              id={
                line.agency?.name
                  ? "transit.line.fineprint"
                  : "transit.line.fineprint.noAgency"
              }
              values={{
                agency: line.agency?.name ?? "",
                region: line.region ?? "",
                id: line.gtfsId,
              }}
            />
          </p>
        </footer>
      )}
    </article>
  );
}

function pickPattern(
  patterns: Pattern[],
  direction: DirectionId,
): Pattern | undefined {
  return patterns.find((p) => p.directionId === direction) ?? patterns[0];
}

function formatClock(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString("fi-FI", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StopStatus = "imminent" | "soon" | "later" | "none";

function statusFor(
  nextUnix: number | null | undefined,
  nowSec: number,
): StopStatus {
  if (nextUnix == null) return "none";
  const diff = nextUnix - nowSec;
  if (diff <= 120) return "imminent";
  if (diff <= 600) return "soon";
  return "later";
}

function relativeMinutes(nextUnix: number, nowSec: number): number {
  return Math.max(0, Math.round((nextUnix - nowSec) / 60));
}

function nowSubscribe(callback: () => void): () => void {
  const id = setInterval(callback, 30_000);
  return () => clearInterval(id);
}
function nowSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

interface LineStopRowsProps {
  stops: Pattern["stops"];
  departures: LineStopDeparture[];
  modeToken: string;
  intl: ReturnType<typeof useIntl>;
}

function LineStopRows({
  stops,
  departures,
  modeToken,
  intl,
}: LineStopRowsProps) {
  const now = useSyncExternalStore(nowSubscribe, nowSnapshot);
  const lastIndex = stops.length - 1;
  const byGtfsId = new Map<string, LineStopDeparture>();
  for (const d of departures) byGtfsId.set(d.stop.gtfsId, d);

  const rows: Array<StopRowProps & { id: string }> = stops.map((stop, i) => {
    const enrich = byGtfsId.get(stop.gtfsId);
    const isTerminus = i === lastIndex;
    const next = enrich?.nextDepartureUnix ?? null;
    const status = statusFor(next, now);
    return {
      id: `${stop.gtfsId}-${i}`,
      name: stop.name,
      secondary: stop.platformCode ?? undefined,
      state: isTerminus ? "terminus" : "upcoming",
      time: (
        <span
          className={`line-card__time line-card__time--${status}`}
          data-status={status}
        >
          {next != null ? (
            <>
              <span
                className="line-card__live"
                aria-hidden="true"
                data-status={status}
              />
              <span className="line-card__clock">{formatClock(next)}</span>
              <span className="line-card__rel">
                {intl.formatMessage(
                  { id: "transit.line.stops.relative" },
                  { minutes: relativeMinutes(next, now) },
                )}
              </span>
            </>
          ) : isTerminus ? (
            <span className="line-card__terminus">
              {intl.formatMessage({ id: "transit.line.stops.terminus" })}
            </span>
          ) : (
            <span
              className="line-card__none"
              aria-label={intl.formatMessage({
                id: "transit.line.stops.noDeparture",
              })}
              data-content="em-dash"
            />
          )}
        </span>
      ),
    };
  });

  return (
    <StopList
      stops={rows}
      modeToken={modeToken}
      ariaLabel={intl.formatMessage({ id: "transit.line.stops.label" })}
    />
  );
}
