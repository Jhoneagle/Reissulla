import { useEffect, useMemo, useRef, useState } from "react";
import { Marker } from "react-leaflet";
import { divIcon, type LatLngTuple } from "leaflet";
import type { VehiclePosition } from "@reissulla/shared";

interface VehicleDotProps {
  vehicle: VehiclePosition;
  /** Mode token (bus/tram/rail/subway/ferry) — drives the dot tint. */
  modeToken: string;
  /** When true, snap to the new position instead of tweening. */
  reduceMotion: boolean;
}

/**
 * One live vehicle on the map. A Leaflet `divIcon` marker tinted with the
 * line's mode colour, with an optional chevron rotated to the reported
 * bearing. Presentational only (`interactive={false}`, the icon is
 * `aria-hidden`) — the SR-accessible surface is the `<VehicleList>` panel,
 * so screen-reader users don't hear 30 dot-by-dot announcements. Position
 * tweens over ~1 s by default; under reduce-motion it snaps.
 */
export function VehicleDot({
  vehicle,
  modeToken,
  reduceMotion,
}: VehicleDotProps) {
  const position = useTweenedPosition([vehicle.lat, vehicle.lon], reduceMotion);

  // Round the bearing so small GPS jitters don't churn the icon every frame.
  const bearing =
    typeof vehicle.bearing === "number"
      ? Math.round(vehicle.bearing / 5) * 5
      : undefined;

  const icon = useMemo(() => {
    const chevron =
      bearing !== undefined
        ? `<span class="vehicle-dot__chevron" style="transform: rotate(${bearing}deg)"></span>`
        : "";
    return divIcon({
      className: "vehicle-dot-wrap",
      html: `<span class="vehicle-dot vehicle-dot--${modeToken}" aria-hidden="true">${chevron}</span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }, [modeToken, bearing]);

  return (
    <Marker
      position={position}
      icon={icon}
      interactive={false}
      keyboard={false}
    />
  );
}

/**
 * Tween a marker position from its previous value to `target` over ~1 s via
 * requestAnimationFrame. Returns `target` immediately when reduce-motion is
 * effective (the dot snaps). SSR-safe — falls back to the target when no
 * rAF is available.
 */
function useTweenedPosition(
  target: LatLngTuple,
  reduceMotion: boolean,
): LatLngTuple {
  // `animated` is null until the first frame lands; render falls back to the
  // raw target then (and always, under reduce-motion) — so the snap path
  // never calls setState synchronously inside the effect.
  const [animated, setAnimated] = useState<LatLngTuple | null>(null);
  const fromRef = useRef<LatLngTuple>(target);
  const rafRef = useRef<number | null>(null);
  const [lat, lon] = target;

  useEffect(() => {
    if (
      reduceMotion ||
      typeof window === "undefined" ||
      typeof requestAnimationFrame === "undefined"
    ) {
      fromRef.current = [lat, lon];
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const DURATION_MS = 1000;
    const step = (now: number): void => {
      const k = Math.min(1, (now - start) / DURATION_MS);
      setAnimated([
        from[0] + (lat - from[0]) * k,
        from[1] + (lon - from[1]) * k,
      ]);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = [lat, lon];
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [lat, lon, reduceMotion]);

  return reduceMotion || animated === null ? [lat, lon] : animated;
}
