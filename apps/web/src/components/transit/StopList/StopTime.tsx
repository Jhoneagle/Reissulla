import { FormattedMessage } from "react-intl";
import { formatUnixTime } from "../../../lib/transit-utils";
import type { StopTimeProps } from "./types";

const LATE_EARLY_THRESHOLD_SEC = 30;

function timesEqualToMinute(a: number, b: number): boolean {
  return Math.floor(a / 60) === Math.floor(b / 60);
}

/**
 * Time renderer for trip / line stop rows.
 *
 * - Late by >30s → late colour, scheduled strikethrough on the left.
 * - Early by >30s → early colour, no strikethrough (we don't visualise an
 *   "earlier than scheduled" baseline; the colour alone reads as "ahead").
 * - `secondary` renders as "{primary} → {secondary}" when the two differ
 *   to the minute. Common at terminus turnarounds and long dwells.
 * - `relativeFromNow` adds a small "{n} min" line below.
 */
export function StopTime({
  primary,
  scheduled,
  delay = 0,
  secondary,
  relativeFromNow = false,
  nowUnix,
}: StopTimeProps) {
  const isLate = delay > LATE_EARLY_THRESHOLD_SEC;
  const isEarly = delay < -LATE_EARLY_THRESHOLD_SEC;
  const showScheduledStrike =
    isLate &&
    scheduled !== undefined &&
    !timesEqualToMinute(scheduled, primary);
  const showSecondary =
    secondary !== undefined && !timesEqualToMinute(primary, secondary);

  const primaryClass = isLate
    ? "stop-time__primary stop-time--late"
    : isEarly
      ? "stop-time__primary stop-time--early"
      : "stop-time__primary";

  // `nowUnix` is supplied by the page-level clock store (see TripDetail);
  // we never reach for the wall clock from inside this pure component.
  const minutesFromNow =
    relativeFromNow && nowUnix !== undefined
      ? Math.max(0, Math.round((primary - nowUnix) / 60))
      : null;

  return (
    <span className="stop-time">
      {showScheduledStrike && (
        <span className="stop-time__scheduled">
          {formatUnixTime(scheduled!)}
        </span>
      )}
      <span className={primaryClass}>{formatUnixTime(primary)}</span>
      {showSecondary && (
        <>
          <span className="stop-time__sep" aria-hidden="true" />
          <span className={primaryClass}>{formatUnixTime(secondary!)}</span>
        </>
      )}
      {minutesFromNow !== null && (
        <span className="stop-time__relative">
          <FormattedMessage
            id="transit.trip.relativeMin"
            values={{ minutes: minutesFromNow }}
          />
        </span>
      )}
    </span>
  );
}
