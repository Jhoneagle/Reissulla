import { useIntl } from "react-intl";
import type { TransitDeparture } from "@reissulla/shared";
import {
  departureToEpoch,
  formatDepartureTime,
  formatRelativeTime,
  vehicleModeColor,
} from "../../lib/transit-utils";

interface DepartureRowProps {
  departure: TransitDeparture;
  showPlatform?: boolean;
}

export function DepartureRow({
  departure: d,
  showPlatform,
}: DepartureRowProps) {
  const intl = useIntl();
  const realtimeEpoch = departureToEpoch(d.serviceDay, d.realtimeDeparture);
  const scheduledEpoch = departureToEpoch(d.serviceDay, d.scheduledDeparture);
  const isDelayed = d.departureDelay > 30;
  const isEarly = d.departureDelay < -30;
  const rtLabel = intl.formatMessage({
    id: d.realtime ? "transit.depart.realtime" : "transit.depart.scheduled",
  });

  return (
    <tr className="departure-row">
      <td className="departure-row__line">
        <span
          className="mode-badge"
          style={{ backgroundColor: vehicleModeColor(d.vehicleMode) }}
        >
          {d.routeShortName}
        </span>
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
        {isDelayed && (
          <span className="departure-row__scheduled">
            {formatDepartureTime(scheduledEpoch)}
          </span>
        )}
        <span
          className={
            isDelayed
              ? "departure-row__actual departure-row__actual--late"
              : isEarly
                ? "departure-row__actual departure-row__actual--early"
                : "departure-row__actual"
          }
        >
          {formatDepartureTime(realtimeEpoch)}
        </span>
        <span className="departure-row__relative">
          {formatRelativeTime(realtimeEpoch)}
        </span>
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
