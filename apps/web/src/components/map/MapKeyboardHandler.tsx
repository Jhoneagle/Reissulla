import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useIntl } from "react-intl";
import type { LatLngTuple } from "leaflet";

interface MapKeyboardHandlerProps {
  /** Where Home key recentres the map. */
  homeCenter: LatLngTuple;
  homeZoom: number;
}

/**
 * MAP-1 keyboard support beyond Leaflet's defaults. Leaflet already handles
 * arrow-key panning and `+`/`-` zoom via `MapContainer keyboard={true}`;
 * this component layers the Home-key recentre on top, scoped to the
 * Leaflet container so it doesn't hijack the key when the user is in
 * another form field on the page.
 *
 * Also stamps the accessible name on the container — `MapContainer`
 * silently drops `aria-label` props, so we set it imperatively via the
 * Leaflet element handle once we have a `useMap()` reference.
 */
export function MapKeyboardHandler({
  homeCenter,
  homeZoom,
}: MapKeyboardHandlerProps) {
  const map = useMap();
  const intl = useIntl();

  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute(
      "aria-label",
      intl.formatMessage({ id: "map.aria.label" }),
    );
    container.setAttribute("role", "region");

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Home") return;
      e.preventDefault();
      map.setView(homeCenter, homeZoom);
    };
    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }, [map, homeCenter, homeZoom, intl]);

  return null;
}
