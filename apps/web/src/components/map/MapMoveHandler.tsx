import { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import { saveLastViewed } from "../../hooks/useDefaultCenter";
import { useMapStore } from "../../stores/map";

const DEBOUNCE_MS = 500;

/**
 * Persists the map's center+zoom to localStorage on moveend / zoomend,
 * debounced so a smooth pan only writes once.
 *
 * When MAP-7 follow-me is on, suppress persistence — the move is the
 * camera chasing GPS, not a user-driven choice; persisting it would
 * make the next cold-start spawn at wherever the GPS happened to be
 * when the tab closed.
 */
export function MapMoveHandler() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followMe = useMapStore((s) => s.followMe);

  const map = useMapEvents({
    moveend() {
      if (followMe) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const c = map.getCenter();
        saveLastViewed(c.lat, c.lng, map.getZoom());
      }, DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
