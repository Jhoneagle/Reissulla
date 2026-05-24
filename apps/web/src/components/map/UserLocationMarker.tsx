import { useEffect, useRef } from "react";
import { Marker } from "react-leaflet";
import { useIntl } from "react-intl";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";

// 24×24 wrapper hits the WCAG 2.2 SC 2.5.8 target-size threshold,
// even though the marker is non-interactive — keeps the rule
// satisfied without per-marker exceptions.
const userIcon = L.divIcon({
  className: "user-location-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface UserLocationMarkerProps {
  position: LatLngExpression;
}

export function UserLocationMarker({ position }: UserLocationMarkerProps) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "map.userLocation.label" });
  const markerRef = useRef<L.Marker | null>(null);

  // react-leaflet's <Marker> accepts `title` but no `aria-label`. Mirror
  // the SavedLocationMarkers treatment so screen readers get the
  // localised name on the same attribute everywhere.
  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (el) el.setAttribute("aria-label", label);
  }, [label]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={userIcon}
      interactive={false}
      title={label}
    />
  );
}
