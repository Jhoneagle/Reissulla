import { Marker } from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";

const userIcon = L.divIcon({
  className: "user-location-marker",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface UserLocationMarkerProps {
  position: LatLngExpression;
}

export function UserLocationMarker({ position }: UserLocationMarkerProps) {
  return (
    <Marker
      position={position}
      icon={userIcon}
      interactive={false}
      aria-label="Your current location"
    />
  );
}
