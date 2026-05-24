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
  return (
    <Marker
      position={position}
      icon={userIcon}
      interactive={false}
      alt={label}
      title={label}
    />
  );
}
