import { useIntl } from "react-intl";
import type { VehiclePosition } from "@reissulla/shared";

interface VehicleListProps {
  vehicles: VehiclePosition[];
  /** Resolve a vehicle's GTFS directionId to the line's headsign for it. */
  headsignFor: (directionId: string | undefined) => string;
}

/**
 * Screen-reader-accessible expression of the live vehicle set — the SR
 * counterpart to the presentational map dots. Each row is a `<li>` with a
 * structured `aria-label` carrying vehicle id, direction (headsign), and
 * delay, so SR users get the same information the dots convey visually.
 * Updates from the same SSE subscription as the map, so the two stay in
 * lockstep.
 */
export function VehicleList({ vehicles, headsignFor }: VehicleListProps) {
  const intl = useIntl();

  if (vehicles.length === 0) {
    return (
      <p className="vehicle-list__empty" role="status">
        {intl.formatMessage({ id: "transit.live.vehicles.empty" })}
      </p>
    );
  }

  const delayText = (delaySeconds: number | null): string => {
    if (delaySeconds === null) {
      return intl.formatMessage({ id: "transit.live.vehicles.delay.unknown" });
    }
    const minutes = Math.round(delaySeconds / 60);
    if (minutes > 0) {
      return intl.formatMessage(
        { id: "transit.live.vehicles.delay.late" },
        { minutes },
      );
    }
    if (minutes < 0) {
      return intl.formatMessage(
        { id: "transit.live.vehicles.delay.early" },
        { minutes: Math.abs(minutes) },
      );
    }
    return intl.formatMessage({ id: "transit.live.vehicles.delay.onTime" });
  };

  return (
    <ul
      className="vehicle-list"
      aria-label={intl.formatMessage({ id: "transit.live.vehicles.title" })}
    >
      {vehicles.map((v) => {
        const headsign = headsignFor(v.directionId);
        const shortId = v.vehicleId.includes("/")
          ? v.vehicleId.slice(v.vehicleId.indexOf("/") + 1)
          : v.vehicleId;
        const delay = delayText(v.delaySeconds);
        return (
          <li
            key={v.vehicleId}
            className="vehicle-list__row"
            aria-label={intl.formatMessage(
              { id: "transit.live.vehicles.rowLabel" },
              { id: v.vehicleId, headsign, delay },
            )}
          >
            <span className="vehicle-list__id" aria-hidden="true">
              {shortId}
            </span>
            <span className="vehicle-list__headsign" aria-hidden="true">
              {headsign}
            </span>
            <span className="vehicle-list__delay" aria-hidden="true">
              {delay}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
