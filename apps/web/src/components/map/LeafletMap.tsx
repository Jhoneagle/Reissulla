import { MapContainer, TileLayer } from "react-leaflet";
import type { ReactNode } from "react";
import type { LatLngExpression } from "leaflet";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

interface LeafletMapProps {
  center: LatLngExpression;
  zoom: number;
  children?: ReactNode;
}

export function LeafletMap({ center, zoom, children }: LeafletMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="leaflet-map"
      keyboard={true}
      zoomControl={true}
    >
      <TileLayer
        attribution={ATTRIBUTION}
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}
