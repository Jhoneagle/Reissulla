import type { GeoJsonPolygon } from "../../adapters/fmi/types.js";

/**
 * Point-in-polygon (ray-casting) for filtering FMI warning polygons against
 * a requested coordinate. JS-first by design: FMI publishes ~5–15 active
 * polygons nationwide at any moment and a user request resolves one location,
 * so the cost is trivial. PostGIS (`ST_Contains`) is the escape hatch if a
 * future surface (map-wide visible polygon set, regional analytics) makes
 * the JS approach quadratic — see `tmp-docs/phase-3-plan.md` §11.5.
 *
 * Coordinates follow GeoJSON convention: `[lon, lat]` ordering in the
 * polygon ring; the caller passes `(lat, lon)` for the test point so
 * service-level usage reads naturally.
 */
export function isPointInsidePolygon(
  lat: number,
  lon: number,
  polygon: GeoJsonPolygon,
): boolean {
  for (const ring of polygon.coordinates) {
    if (isInsideRing(lon, lat, ring)) return true;
  }
  return false;
}

function isInsideRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
