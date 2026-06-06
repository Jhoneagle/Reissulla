import { Circle, MapContainer, TileLayer } from "react-leaflet";
import type { ReactNode } from "react";
import type { LatLngExpression } from "leaflet";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

interface LeafletMapProps {
  center: LatLngExpression;
  zoom: number;
  children?: ReactNode;
  /**
   * MAP-6: optional translucent search-radius circle drawn at `center`. The
   * dashboard nearby-stops surface passes the adaptive radius here so users
   * see how far the planner is looking.
   */
  searchRadiusMeters?: number;
}

export function LeafletMap({
  center,
  zoom,
  children,
  searchRadiusMeters,
}: LeafletMapProps) {
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
      {typeof searchRadiusMeters === "number" && searchRadiusMeters > 0 && (
        <Circle
          center={center}
          radius={searchRadiusMeters}
          pathOptions={{
            color: "var(--color-rule)",
            weight: 1,
            fillColor: "var(--color-primary)",
            fillOpacity: 0.08,
          }}
        />
      )}
      {children}
    </MapContainer>
  );
}
