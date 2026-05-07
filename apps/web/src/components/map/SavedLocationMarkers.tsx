import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { SavedLocation } from "@reissulla/shared";

const savedIcon = L.divIcon({
  className: "saved-location-marker",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface SavedLocationMarkersProps {
  locations: SavedLocation[];
  onSelect: (location: SavedLocation) => void;
}

export function SavedLocationMarkers({
  locations,
  onSelect,
}: SavedLocationMarkersProps) {
  return (
    <>
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={savedIcon}
          eventHandlers={{
            click: () => onSelect(loc),
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {loc.name}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
