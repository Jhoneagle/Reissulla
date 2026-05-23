import { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import { saveLastViewed } from "../../hooks/useDefaultCenter";

const DEBOUNCE_MS = 500;

/**
 * Persists the map's center+zoom to localStorage on moveend / zoomend,
 * debounced so a smooth pan only writes once.
 */
export function MapMoveHandler() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const map = useMapEvents({
    moveend() {
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
