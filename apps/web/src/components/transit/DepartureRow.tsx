import { useIntl } from "react-intl";
import type { TransitDeparture } from "@reissulla/shared";
import type { ArrivalDepartureMode } from "@reissulla/api-client";
import {
  departureToEpoch,
  formatDepartureTime,
  formatRelativeTime,
  vehicleModeToken,
} from "../../lib/transit-utils";

interface DepartureRowProps {
  departure: TransitDeparture;
  /** Drives which time column renders + the column header label. */
  mode: ArrivalDepartureMode;
  showPlatform?: boolean;
}

function timesEqualToMinute(aSec: number, bSec: number): boolean {
  return Math.floor(aSec / 60) === Math.floor(bSec / 60);
}

export function DepartureRow({
  departure: d,
  mode,
  showPlatform,
}: DepartureRowProps) {
  const intl = useIntl();
  const modeToken = vehicleModeToken(d.vehicleMode);
  const rtLabel = intl.formatMessage({
    id: d.realtime ? "transit.depart.realtime" : "transit.depart.scheduled",
  });

  const arrivalEpoch = departureToEpoch(d.serviceDay, d.realtimeArrival);
  const arrivalScheduledEpoch = departureToEpoch(
    d.serviceDay,
    d.scheduledArrival,
  );
  const departureEpoch = departureToEpoch(d.serviceDay, d.realtimeDeparture);
  const departureScheduledEpoch = departureToEpoch(
    d.serviceDay,
    d.scheduledDeparture,
  );

  const departureLate = d.departureDelay > 30;
  const departureEarly = d.departureDelay < -30;
  const arrivalLate = d.arrivalDelay > 30;
  const arrivalEarly = d.arrivalDelay < -30;

  const showDeparture = mode === "departures" || mode === "both";
  const showBoth =
    mode === "both" &&
    !timesEqualToMinute(d.realtimeArrival, d.realtimeDeparture);

  const primaryEpoch = showBoth
    ? arrivalEpoch
    : showDeparture
      ? departureEpoch
      : arrivalEpoch;

  // SR-only late/early phrase — visual cue is the colour treatment;
  // SR users hear the magnitude in minutes.
  const delayMin = showDeparture
    ? Math.round(d.departureDelay / 60)
    : Math.round(d.arrivalDelay / 60);
  const isLate = showDeparture ? departureLate : arrivalLate;
  const isEarly = showDeparture ? departureEarly : arrivalEarly;
  const announcement = isLate
    ? intl.formatMessage(
        { id: "transit.depart.lateBy" },
        { line: d.routeShortName, minutes: delayMin },
      )
    : isEarly
      ? intl.formatMessage(
          { id: "transit.depart.earlyBy" },
          { line: d.routeShortName, minutes: Math.abs(delayMin) },
        )
      : "";

  return (
    <tr className="departure-row">
      <td className="departure-row__line">
        <span className={`mode-tag mode-${modeToken}`}>{d.routeShortName}</span>
      </td>
      <td className="departure-row__dest">{d.headsign}</td>
      {showPlatform && (
        <td className="departure-row__platform">
          {d.platformCode && (
            <span className="platform-badge">{d.platformCode}</span>
          )}
        </td>
      )}
      <td className="departure-row__time">
        {showBoth ? (
          <span className="departure-row__pair">
            <span
              className={
                arrivalLate
                  ? "departure-row__actual departure-row__actual--late"
                  : arrivalEarly
                    ? "departure-row__actual departure-row__actual--early"
                    : "departure-row__actual"
              }
            >
              {formatDepartureTime(arrivalEpoch)}
            </span>
            <span className="departure-row__sep" aria-hidden="true" />
            <span
              className={
                departureLate
                  ? "departure-row__actual departure-row__actual--late"
                  : departureEarly
                    ? "departure-row__actual departure-row__actual--early"
                    : "departure-row__actual"
              }
            >
              {formatDepartureTime(departureEpoch)}
            </span>
          </span>
        ) : (
          <>
            {isLate && (
              <span className="departure-row__scheduled">
                {formatDepartureTime(
                  showDeparture
                    ? departureScheduledEpoch
                    : arrivalScheduledEpoch,
                )}
              </span>
            )}
            <span
              className={
                isLate
                  ? "departure-row__actual departure-row__actual--late"
                  : isEarly
                    ? "departure-row__actual departure-row__actual--early"
                    : "departure-row__actual"
              }
            >
              {formatDepartureTime(
                showDeparture ? departureEpoch : arrivalEpoch,
              )}
            </span>
          </>
        )}
        <span className="departure-row__relative">
          {formatRelativeTime(primaryEpoch)}
        </span>
        {announcement && (
          <span className="visually-hidden">{announcement}</span>
        )}
      </td>
      <td className="departure-row__rt">
        <span
          className={`rt-dot${d.realtime ? " rt-dot--live" : ""}`}
          aria-label={rtLabel}
          title={rtLabel}
        />
      </td>
    </tr>
  );
}
