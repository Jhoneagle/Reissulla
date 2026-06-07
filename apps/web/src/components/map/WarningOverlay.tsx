import { Polygon, Tooltip } from "react-leaflet";
import type {
  LatLngExpression,
  PathOptions as LeafletPathOptions,
} from "leaflet";
import type { WeatherWarning, WeatherWarningSeverity } from "@reissulla/shared";
import { useWarningPolygons } from "../../hooks/useWarningPolygons";
import { useMapStore } from "../../stores/map";

/**
 * Map overlay rendering active FMI warning polygons coloured by
 * severity. Minor / moderate ride on the `--color-warning` family;
 * severe / extreme switch to `--color-error`. The same severity →
 * token map drives `.warning-banner__*` in Weather.css (see §6 of the
 * Phase 3 plan), so a banner-and-overlay pair always matches.
 *
 * Renders nothing when the overlay-warnings layer is off or the FMI
 * fetch is still cold; the query is gated by the same flag so we don't
 * pay the round-trip until the user opts in.
 */

interface StyleSpec {
  fillColor: string;
  color: string;
}

function styleFor(severity: WeatherWarningSeverity): StyleSpec {
  if (severity === "severe" || severity === "extreme") {
    return { fillColor: "#8b1818", color: "#8b1818" };
  }
  return { fillColor: "#7a4f0a", color: "#7a4f0a" };
}

function toLeafletRings(warning: WeatherWarning): LatLngExpression[][] {
  if (!warning.bounds) return [];
  // GeoJSON rings are [lon, lat]; Leaflet wants [lat, lng].
  return warning.bounds.coordinates.map((ring) =>
    ring.map(([lon, lat]) => [lat!, lon!] as LatLngExpression),
  );
}

export function WarningOverlay() {
  const visible = useMapStore((s) => s.overlays.has("overlay-warnings"));
  const { data } = useWarningPolygons(visible);

  if (!visible || !data) return null;

  return (
    <>
      {data.data.polygons.map((warning) => {
        const rings = toLeafletRings(warning);
        if (rings.length === 0) return null;
        const { fillColor, color } = styleFor(warning.severity);
        const pathOptions: LeafletPathOptions = {
          fillColor,
          color,
          weight: 1.5,
          fillOpacity: 0.18,
          opacity: 0.7,
        };
        return (
          <Polygon key={warning.id} positions={rings} pathOptions={pathOptions}>
            <Tooltip sticky>
              <strong>{warning.description}</strong>
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
