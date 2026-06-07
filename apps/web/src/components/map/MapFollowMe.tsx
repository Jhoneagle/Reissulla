import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "../../stores/map";
import { useGeolocationStore } from "../../stores/geolocation";

/**
 * MAP-7 follow-me: when `followMe` is on in MapStore, chase GPS updates
 * by panning the map to the user's latest position. Stays out of the
 * way when the toggle is off so the normal pan/zoom-from-localStorage
 * flow remains untouched.
 *
 * Uses `panTo` (no zoom change) rather than `flyTo` so successive GPS
 * updates feel smooth instead of zoom-restoring on every tick. The
 * MapMoveHandler is taught to skip persistence while followMe is on so
 * the chase doesn't burn one localStorage write per GPS update.
 */
export function MapFollowMe() {
  const map = useMap();
  const followMe = useMapStore((s) => s.followMe);
  const position = useGeolocationStore((s) => s.position);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!followMe || !position) return;
    const key = `${position.lat.toFixed(5)}:${position.lon.toFixed(5)}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    map.panTo([position.lat, position.lon]);
  }, [map, followMe, position]);

  return null;
}
