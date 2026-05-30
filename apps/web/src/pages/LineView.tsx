import { useEffect, useSyncExternalStore } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, useParams, useSearchParams } from "react-router";
import type {
  DayType,
  DirectionId,
  LineStopDeparture,
  Pattern,
} from "@reissulla/shared";
import { ApiError } from "@reissulla/api-client";
import { useFrequency, useLine, useLineDepartures } from "../hooks/useTransit";
import { vehicleModeToken } from "../lib/transit-utils";
import { StopList, type StopRowProps } from "../components/transit/StopList";
import { DirectionToggle } from "../components/transit/DirectionToggle";
import { FrequencyStrip } from "../components/transit/FrequencyStrip";
import { LinePinButton } from "../components/transit/LinePinButton";
import "../components/transit/StopList/stop-list.css";
import "./LineView.css";

export function LineView() {
  const intl = useIntl();
  const { gtfsId: rawGtfsId } = useParams<{ gtfsId: string }>();
  const gtfsId = rawGtfsId ? decodeURIComponent(rawGtfsId) : null;

  const [searchParams, setSearchParams] = useSearchParams();
  const direction = parseDirection(searchParams.get("dir"));
  const dayType = parseDayType(searchParams.get("dayType")) ?? "weekday";

  const lineQuery = useLine(gtfsId);
  const departuresQuery = useLineDepartures(gtfsId, direction);
  const frequencyQuery = useFrequency(gtfsId, dayType, direction);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [gtfsId]);

  if (lineQuery.isLoading) return <LineViewLoading />;
  if (lineQuery.isError) {
    const notFound =
      lineQuery.error instanceof ApiError && lineQuery.error.status === 404;
    return (
      <LineViewError
        notFound={notFound}
        onRetry={notFound ? undefined : () => lineQuery.refetch()}
      />
    );
  }

  const line = lineQuery.data?.data;
  if (!line || line.patterns.length === 0) {
    return <LineViewEmpty />;
  }

  const pattern = pickPattern(line.patterns, direction);
  if (!pattern) return <LineViewEmpty />;

  const modeToken = vehicleModeToken(line.mode);
  const departures = departuresQuery.data?.data ?? [];
  const stopRows = (
    <LineStopRows
      stops={pattern.stops}
      departures={departures}
      modeToken={modeToken}
      intl={intl}
    />
  );

  return (
    <article className={`line-view line-view--mode-${modeToken}`}>
      <BackLink />

      <header className="line-view__masthead">
        <div className="line-view__masthead-top">
          <p className="line-view__kicker">
            <FormattedMessage id="transit.line.kicker" />
          </p>
          <LinePinButton
            gtfsId={line.gtfsId}
            name={line.shortName}
            vehicleMode={line.mode}
          />
        </div>
        <hr className="line-view__top-rule" />
        <div className="line-view__display">
          <span className="line-view__number">{line.shortName}</span>
          <p className="line-view__headsign">
            <span className="line-view__origin">
              {pattern.stops[0]?.name ?? ""}
            </span>
            <span className="line-view__arrow" aria-hidden="true" />
            <span className="line-view__destination">{pattern.headsign}</span>
          </p>
        </div>
      </header>

      <DirectionToggle
        patterns={line.patterns}
        active={(direction ?? 0) as DirectionId}
        onChange={(next) =>
          setSearchParams(setParam(searchParams, "dir", String(next)))
        }
      />

      <FrequencyStrip
        bands={frequencyQuery.data?.data ?? []}
        modeToken={modeToken}
        dayType={dayType}
        onDayTypeChange={(next) =>
          setSearchParams(setParam(searchParams, "dayType", next))
        }
      />

      {stopRows}

      <footer className="line-view__fineprint">
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
    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers + state plates
// ---------------------------------------------------------------------------

function parseDirection(raw: string | null): DirectionId | undefined {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return undefined;
}

function parseDayType(raw: string | null): DayType | undefined {
  if (raw === "weekday" || raw === "saturday" || raw === "sunday") return raw;
  return undefined;
}

function setParam(
  current: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set(key, value);
  return next;
}

function pickPattern(
  patterns: Pattern[],
  direction: DirectionId | undefined,
): Pattern | undefined {
  if (direction !== undefined) {
    return patterns.find((p) => p.directionId === direction) ?? patterns[0];
  }
  return patterns[0];
}

function formatClock(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString("fi-FI", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Bucket the time-until-next-departure into a status tier. The dot colour
 * keys off this — green when a vehicle is at/just-leaving the stop, amber
 * for the next 10-minute window, gray when farther out, and `none` when
 * the upstream lookahead window returned no scheduled departure for the
 * stop. `null` means "no data, render no dot".
 */
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

// Same external-store ticker pattern as TripDetail — keeps the relative
// times rolling without re-rendering the world.
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
          className={`line-view__time line-view__time--${status}`}
          data-status={status}
        >
          {next != null ? (
            <>
              <span
                className="line-view__live"
                aria-hidden="true"
                data-status={status}
              />
              <span className="line-view__clock">{formatClock(next)}</span>
              <span className="line-view__rel">
                {intl.formatMessage(
                  { id: "transit.line.stops.relative" },
                  { minutes: relativeMinutes(next, now) },
                )}
              </span>
            </>
          ) : isTerminus ? (
            <span className="line-view__terminus">
              {intl.formatMessage({ id: "transit.line.stops.terminus" })}
            </span>
          ) : (
            <span
              className="line-view__none"
              aria-label={intl.formatMessage({
                id: "transit.line.stops.noDeparture",
              })}
            >
              —
            </span>
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

function BackLink() {
  // Plain anchor — no JS interception. The Link's natural navigation
  // pushes a single history entry to /transit?tab=lines, so internal
  // URL-param changes (dir, dayType) on the LineView don't get in the
  // way of returning to the search.
  return (
    <nav className="line-view__back">
      <Link to="/transit?tab=lines">
        <FormattedMessage id="transit.line.back" />
      </Link>
    </nav>
  );
}

function LineViewLoading() {
  return (
    <article className="line-view line-view--loading">
      <div className="line-view__skeleton" aria-hidden="true">
        <div className="skel" style={{ width: "40%", height: "5rem" }} />
        <div className="skel" style={{ width: "60%", height: "1.5rem" }} />
        <div className="skel" style={{ width: "80%", height: "1rem" }} />
      </div>
      <div aria-live="polite" className="visually-hidden">
        <FormattedMessage id="transit.line.heading" />
      </div>
    </article>
  );
}

function LineViewError({
  notFound,
  onRetry,
}: {
  notFound: boolean;
  onRetry?: () => void;
}) {
  return (
    <article className="line-view line-view--error">
      <BackLink />
      <div className="line-view__error-block">
        <p>
          <FormattedMessage
            id={notFound ? "transit.line.notFound" : "transit.line.error"}
          />
        </p>
        {onRetry && (
          <button type="button" className="retry-btn" onClick={onRetry}>
            <FormattedMessage id="transit.line.retry" />
          </button>
        )}
      </div>
    </article>
  );
}

function LineViewEmpty() {
  return (
    <article className="line-view line-view--empty">
      <BackLink />
      <div className="line-view__error-block">
        <p>
          <FormattedMessage id="transit.line.empty" />
        </p>
      </div>
    </article>
  );
}
