import { Circle, MapContainer, TileLayer } from "react-leaflet";
import type { ReactNode } from "react";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import { useMapStore } from "../../stores/map";
import { LAYERS } from "./layers";
import { MapKeyboardHandler } from "./MapKeyboardHandler";

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
  const baseLayerId = useMapStore((s) => s.baseLayer);
  const layer = LAYERS[baseLayerId];
  // Defence-in-depth: registry is exhaustive over LayerId, but tests / hot-
  // reload edge cases can produce a transient unknown ID. Fall back to OSM.
  const source =
    layer && layer.source.type === "url"
      ? layer.source
      : LAYERS["tile-streets"].source;
  const attribution = layer?.attribution ?? LAYERS["tile-streets"].attribution;
  const maxZoom = layer?.maxZoom ?? 19;

  const homeCenter: LatLngTuple = Array.isArray(center)
    ? (center as LatLngTuple)
    : [
        (center as { lat: number; lng: number }).lat,
        (center as { lat: number; lng: number }).lng,
      ];

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="leaflet-map"
      keyboard={true}
      zoomControl={true}
    >
      <TileLayer
        key={baseLayerId}
        attribution={attribution}
        url={"template" in source ? source.template : ""}
        subdomains={
          "subdomains" in source && source.subdomains
            ? source.subdomains
            : "abc"
        }
        maxZoom={maxZoom}
      />
      <MapKeyboardHandler homeCenter={homeCenter} homeZoom={zoom} />
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
