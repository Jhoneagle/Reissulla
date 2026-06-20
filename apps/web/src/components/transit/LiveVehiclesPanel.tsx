import { useEffect, useMemo, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Polyline, useMap } from "react-leaflet";
import { latLngBounds, type LatLngTuple } from "leaflet";
import type { DirectionId, Pattern } from "@reissulla/shared";
import { useLine } from "../../hooks/useTransit";
import { useLiveVehicles } from "../../hooks/useLiveVehicles";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { showToast } from "../../stores/toast";
import { vehicleModeToken } from "../../lib/transit-utils";
import { LeafletMap } from "../map/LeafletMap";
import { LiveIndicator } from "./LiveIndicator";
import { VehicleDot } from "./VehicleDot";
import { VehicleList } from "./VehicleList";
import "./live-vehicles.css";

interface LiveVehiclesPanelProps {
  gtfsId: string;
  direction: DirectionId;
}

/**
 * Live-vehicle surface on the LineView page (LIVE-1). Renders the line's
 * route with live vehicle dots on a map and a screen-reader-accessible
 * `<VehicleList>` below — both fed by one SSE subscription so they stay in
 * lockstep. When the server degrades MQTT to the polled GraphQL fallback it
 * surfaces a "live data degraded" notice once per session.
 */
export function LiveVehiclesPanel({
  gtfsId,
  direction,
}: LiveVehiclesPanelProps) {
  const intl = useIntl();
  const lineQuery = useLine(gtfsId);
  const { vehicles, degraded, indicator, enabled } = useLiveVehicles(gtfsId);
  const { effective: reduceMotion } = useReduceMotion();

  const line = lineQuery.data?.data;
  const pattern = line ? pickPattern(line.patterns, direction) : undefined;
  const modeToken = vehicleModeToken(line?.mode);

  const routePoints = useMemo<LatLngTuple[]>(
    () => (pattern ? pattern.stops.map((s) => [s.lat, s.lon]) : []),
    [pattern],
  );

  const headsignFor = useMemo(() => {
    const byDir = new Map<string, string>();
    for (const p of line?.patterns ?? [])
      byDir.set(String(p.directionId), p.headsign);
    return (directionId: string | undefined): string =>
      (directionId !== undefined ? byDir.get(directionId) : undefined) ??
      intl.formatMessage({ id: "transit.live.vehicles.unknownDirection" });
  }, [line, intl]);

  // Announce the degraded fallback once per session per line.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!degraded || notifiedRef.current) return;
    notifiedRef.current = true;
    showToast({
      message: intl.formatMessage({ id: "transit.live.vehicles.degraded" }),
      kind: "info",
    });
  }, [degraded, intl]);

  if (!line || !pattern || routePoints.length === 0) return null;

  const center: LatLngTuple = boundsCenter(routePoints);

  return (
    <section
      className="live-vehicles"
      aria-label={intl.formatMessage({ id: "transit.live.vehicles.title" })}
    >
      <div className="live-vehicles__head">
        <h2 className="live-vehicles__title">
          <FormattedMessage id="transit.live.vehicles.title" />
        </h2>
        {enabled && <LiveIndicator state={indicator} />}
      </div>

      {!enabled && (
        <p className="live-vehicles__notice" role="status">
          <FormattedMessage id="transit.live.vehicles.unavailable" />
        </p>
      )}

      {degraded && (
        <p className="live-vehicles__notice" role="status">
          <FormattedMessage id="transit.live.vehicles.degraded" />
        </p>
      )}

      <div className="live-vehicles__map">
        <LeafletMap center={center} zoom={12}>
          <FitToRoute points={routePoints} />
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: `var(--mode-${modeToken}-strong)`,
              weight: 4,
              opacity: 0.55,
            }}
          />
          {vehicles.map((v) => (
            <VehicleDot
              key={v.vehicleId}
              vehicle={v}
              modeToken={modeToken}
              reduceMotion={reduceMotion}
            />
          ))}
        </LeafletMap>
      </div>

      <VehicleList vehicles={vehicles} headsignFor={headsignFor} />
    </section>
  );
}

/** Fit the map to the route once the geometry is known. */
function FitToRoute({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    // `points` is memoized by the caller, so this re-fits only on a real
    // route change (line / direction switch), not on every vehicle tick.
    map.fitBounds(latLngBounds(points), { padding: [24, 24] });
  }, [map, points]);
  return null;
}

function pickPattern(
  patterns: Pattern[],
  direction: DirectionId,
): Pattern | undefined {
  return patterns.find((p) => p.directionId === direction) ?? patterns[0];
}

function boundsCenter(points: LatLngTuple[]): LatLngTuple {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}
