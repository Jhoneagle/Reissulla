import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { SavedLocation } from "@reissulla/shared";

// 24×24 wrapper hits the WCAG 2.2 SC 2.5.8 target-size threshold;
// the visible 12px dot is painted by the ::before in Map.css so the
// glyph itself stays small.
const savedIcon = L.divIcon({
  className: "saved-location-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
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
          alt={loc.name}
          title={loc.name}
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
