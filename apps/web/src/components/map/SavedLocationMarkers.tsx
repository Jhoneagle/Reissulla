import { useEffect, useRef } from "react";
import { Marker, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
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

interface SavedMarkerProps {
  location: SavedLocation;
  onSelect: (location: SavedLocation) => void;
}

// react-leaflet's <Marker> accepts `title` but no `aria-label`. SC 4.1.2
// is satisfied either way (NVDA/VoiceOver fall back to `title` for the
// accessible name), but `aria-label` is the more explicit modern signal
// and what the design review asked for, so we set it directly on the
// underlying Leaflet element via a ref.
function SavedMarker({ location, onSelect }: SavedMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (el) el.setAttribute("aria-label", location.name);
  }, [location.name]);

  return (
    <Marker
      ref={markerRef}
      position={[location.latitude, location.longitude]}
      icon={savedIcon}
      title={location.name}
      eventHandlers={{
        click: () => onSelect(location),
      }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        {location.name}
      </Tooltip>
    </Marker>
  );
}

/**
 * MAP-5: bucket markers at low zoom via react-leaflet-cluster so a user
 * with many saved places doesn't see overlapping pins. `chunkedLoading`
 * keeps the main thread responsive when the saved-locations list grows
 * past ~50; `spiderfyOnMaxZoom` lets the user fan out a tight cluster.
 */
export function SavedLocationMarkers({
  locations,
  onSelect,
}: SavedLocationMarkersProps) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      maxClusterRadius={45}
    >
      {locations.map((loc) => (
        <SavedMarker key={loc.id} location={loc} onSelect={onSelect} />
      ))}
    </MarkerClusterGroup>
  );
}
