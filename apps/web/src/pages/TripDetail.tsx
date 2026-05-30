import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, useLocation, useParams } from "react-router";
import type { TripDetail, TripDetailStop } from "@reissulla/shared";
import { ApiError } from "@reissulla/api-client";
import { useTripDetail } from "../hooks/useTransit";
import { vehicleModeToken } from "../lib/transit-utils";
import { findCurrentStop, buildTripStatusPhrase } from "../lib/trip-status";
import {
  StopList,
  StopTime,
  type StopRowProps,
} from "../components/transit/StopList";
import "../components/transit/StopList/stop-list.css";
import "./TripDetail.css";

const LIVE_ANNOUNCE_THROTTLE_MS = 60_000;

export function TripDetail() {
  const intl = useIntl();
  const { tripId: rawTripId } = useParams<{ tripId: string }>();
  const tripId = rawTripId ? decodeURIComponent(rawTripId) : null;

  const { data, isLoading, isError, error, refetch } = useTripDetail(tripId);

  // Scroll to top on tripId change so navigating between trips doesn't
  // land mid-scroll.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tripId]);

  if (isLoading) {
    return <TripDetailLoading />;
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <TripDetailError
        notFound={notFound}
        onRetry={notFound ? undefined : () => refetch()}
      />
    );
  }

  const trip = data?.data;
  if (!trip || trip.stops.length === 0) {
    return <TripDetailEmpty />;
  }

  return <TripDetailRendered intl={intl} trip={trip} />;
}

interface RenderedProps {
  intl: ReturnType<typeof useIntl>;
  trip: TripDetail;
}

function TripDetailRendered({ intl, trip }: RenderedProps) {
  const modeToken = vehicleModeToken(trip.route.mode);
  const vehicleWord = intl.formatMessage({
    id: `transit.trip.vehicle.${modeToken}`,
  });

  // External-store ticker — `Date.now()` is read inside the snapshot
  // callback (React's purity rule disallows it during render). 5s
  // granularity is enough for the masthead status sentence + relative-min
  // badges; useTripDetail's 30s refetch keeps the underlying data fresh.
  const now = useSyncExternalStore(nowSubscribe, nowSnapshot);
  const current = useMemo(
    () => findCurrentStop(trip.stops, now),
    [trip.stops, now],
  );

  const statusPhrase = buildTripStatusPhrase(
    current,
    trip.stops,
    vehicleWord,
    intl,
  );

  const currentIndex =
    current.kind === "at" || current.kind === "approaching"
      ? current.index
      : null;

  const pastStops: TripDetailStop[] = [];
  const upcomingStops: TripDetailStop[] = [];
  trip.stops.forEach((s, i) => {
    if (currentIndex !== null && i < currentIndex) pastStops.push(s);
    else upcomingStops.push(s);
  });
  // "departed" → every stop is in the past; the disclosure carries them.
  if (current.kind === "departed") {
    pastStops.push(...upcomingStops.splice(0, upcomingStops.length));
  }

  const lastStopIndex = trip.stops.length - 1;
  const stopRows = (
    list: TripDetailStop[],
    indexOffset: number,
  ): Array<StopRowProps & { id: string }> =>
    list.map((s, i) => {
      const globalIndex = indexOffset + i;
      const isCurrent = globalIndex === currentIndex;
      const isTerminus = globalIndex === lastStopIndex;
      const state: StopRowProps["state"] = isCurrent
        ? "current"
        : globalIndex < (currentIndex ?? Infinity)
          ? "past"
          : isTerminus
            ? "terminus"
            : "upcoming";
      return {
        id: `${s.gtfsId}-${globalIndex}`,
        name: s.name,
        secondary: s.platformCode
          ? intl.formatMessage(
              { id: "transit.trip.platform" },
              { code: s.platformCode, mode: modeToken },
            )
          : undefined,
        state,
        time: (
          <StopTime
            primary={s.departureTime}
            scheduled={s.scheduledDeparture}
            delay={s.departureDelay}
            secondary={
              isTerminus || !timesEqualToMinute(s.arrivalTime, s.departureTime)
                ? s.arrivalTime
                : undefined
            }
            relativeFromNow={state === "upcoming"}
            nowUnix={now}
          />
        ),
      };
    });

  const upcomingRows = stopRows(upcomingStops, pastStops.length);
  const pastRows = stopRows(pastStops, 0);

  // Live status announcement — throttled to once per minute.
  const liveAnnouncement = useThrottledAnnouncement(statusPhrase);

  return (
    <article className={`trip-detail trip-detail--mode-${modeToken}`}>
      <BackLink />

      <header className="trip-detail__masthead">
        <p className="trip-detail__kicker">
          <FormattedMessage id="transit.trip.kicker.line" />
        </p>
        <hr className="trip-detail__top-rule" />
        <div className="trip-detail__display">
          <span className="trip-detail__number">{trip.route.shortName}</span>
          <p className="trip-detail__headsign">
            <span className="trip-detail__destination">
              {trip.pattern.headsign}
            </span>
          </p>
          <p className="trip-detail__status">
            <span
              className={`rt-dot${current.kind !== "inactive" ? " rt-dot--live" : ""}`}
              aria-hidden="true"
            />
            <span>{statusPhrase}</span>
          </p>
        </div>
      </header>

      {pastRows.length > 0 && (
        <details className="trip-detail__past">
          <summary>
            <FormattedMessage
              id="transit.trip.past.summary"
              values={{ count: pastRows.length }}
            />
          </summary>
          <StopList
            stops={pastRows}
            modeToken={modeToken}
            ariaLabel={intl.formatMessage({
              id: "transit.trip.stops.pastLabel",
            })}
          />
        </details>
      )}

      <StopList
        stops={upcomingRows}
        modeToken={modeToken}
        ariaLabel={intl.formatMessage({ id: "transit.trip.stops.label" })}
      />

      <footer className="trip-detail__fineprint">
        <p>
          <FormattedMessage
            id={
              trip.agency.name
                ? "transit.trip.fineprint"
                : "transit.trip.fineprint.noAgency"
            }
            values={{
              agency: trip.agency.name,
              date: formatServiceDate(trip.serviceDate),
            }}
          />
        </p>
      </footer>

      <div aria-live="polite" className="visually-hidden">
        {liveAnnouncement}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers + state variants
// ---------------------------------------------------------------------------

function timesEqualToMinute(a: number, b: number): boolean {
  return Math.floor(a / 60) === Math.floor(b / 60);
}

/**
 * "Takaisin pysäkille" / "Back to the stop" link.
 *
 * Plain anchor — no JS interception. The originating /transit URL is
 * round-tripped through router state by DepartureRow, so the back-link
 * can return to the exact filtered board (mode, lineFilter, direction,
 * lowFloor, platform, at). Falls back to bare /transit on deep entry.
 * Using navigate(-1) instead breaks once any in-page state push sits
 * between arrival on this page and the press of the back link.
 */
function BackLink() {
  const location = useLocation();
  const fromRef = useRef<string | null>(null);
  if (fromRef.current === null) {
    const raw = (location.state as { from?: unknown } | null)?.from;
    fromRef.current = typeof raw === "string" && raw.length > 0 ? raw : "";
  }
  const to = fromRef.current || "/transit";
  return (
    <nav className="trip-detail__back">
      <Link to={to}>
        <FormattedMessage id="transit.trip.back" />
      </Link>
    </nav>
  );
}

// Module-level wall-clock store. One subscription per mounted page is
// enough; the snapshot reads `Date.now()` on demand. React-purity-safe
// because the impure call happens in the snapshot callback, not during
// render.
function nowSubscribe(callback: () => void): () => void {
  const id = setInterval(callback, 5000);
  return () => clearInterval(id);
}
function nowSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

/** YYYYMMDD → DD.MM.YYYY */
function formatServiceDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${d}.${m}.${y}`;
}

function useThrottledAnnouncement(message: string): string {
  const [emitted, setEmitted] = useState("");
  const lastEmitRef = useRef<{ text: string; at: number }>({
    text: "",
    at: 0,
  });

  useEffect(() => {
    const now = Date.now();
    if (
      message !== lastEmitRef.current.text &&
      now - lastEmitRef.current.at >= LIVE_ANNOUNCE_THROTTLE_MS
    ) {
      lastEmitRef.current = { text: message, at: now };
      setEmitted(message);
    }
  }, [message]);

  return emitted;
}

function TripDetailLoading() {
  return (
    <article className="trip-detail trip-detail--loading">
      <div className="trip-detail__skeleton" aria-hidden="true">
        <div className="skel" style={{ width: "40%", height: "5rem" }} />
        <div className="skel" style={{ width: "60%", height: "1.5rem" }} />
        <div className="skel" style={{ width: "80%", height: "1rem" }} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="trip-detail__skel-row">
            <div className="skel skel--dot" />
            <div className="skel" style={{ width: "60%", height: "1rem" }} />
            <div className="skel" style={{ width: "3rem", height: "1rem" }} />
          </div>
        ))}
      </div>
      <div aria-live="polite" className="visually-hidden">
        <FormattedMessage id="transit.trip.loading" />
      </div>
    </article>
  );
}

function TripDetailError({
  notFound,
  onRetry,
}: {
  notFound: boolean;
  onRetry?: () => void;
}) {
  return (
    <article className="trip-detail trip-detail--error">
      <BackLink />
      <div className="trip-detail__error-block">
        <p>
          <FormattedMessage
            id={notFound ? "transit.trip.notFound" : "transit.trip.error"}
          />
        </p>
        {onRetry && (
          <button type="button" className="retry-btn" onClick={onRetry}>
            <FormattedMessage id="transit.trip.retry" />
          </button>
        )}
      </div>
    </article>
  );
}

function TripDetailEmpty() {
  return (
    <article className="trip-detail trip-detail--empty">
      <BackLink />
      <div className="trip-detail__error-block">
        <p>
          <FormattedMessage id="transit.trip.empty" />
        </p>
      </div>
    </article>
  );
}
