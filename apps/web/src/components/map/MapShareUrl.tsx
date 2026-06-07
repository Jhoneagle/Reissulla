import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { useSearchParams } from "react-router";
import { isLayerId, type LayerId } from "@reissulla/shared";
import { useMapStore } from "../../stores/map";

const DEBOUNCE_MS = 300;

function parseFloatOrNull(v: string | null): number | null {
  if (v === null) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function parseOverlays(v: string | null): LayerId[] | null {
  if (v === null) return null;
  const parts = v
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return [];
  const out: LayerId[] = [];
  for (const p of parts) if (isLayerId(p)) out.push(p);
  return out;
}

/**
 * MAP-10 share-URL state. Renders nothing; lives inside MapContainer to
 * get `useMap()` and `useMapEvents()`. The query-string shape is
 * `?lat=…&lon=…&z=…&base=…&overlays=a,b,c`.
 *
 * Behaviour:
 *  - On mount, if any of those params are present, hydrate the store and
 *    pan/zoom the map to the URL state.
 *  - On `moveend` / `zoomend`, debounce 300 ms then write current state
 *    back to the URL (replace mode so we don't flood history).
 *  - On store baseLayer / overlay changes, push immediately.
 *
 * One-way sync from the URL is bounded to first mount via a ref so the
 * subsequent self-writes don't bounce back through the parser. Empty
 * URL on first load is a no-op — the store / localStorage drive.
 */
export function MapShareUrl() {
  const map = useMap();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseLayer = useMapStore((s) => s.baseLayer);
  const overlays = useMapStore((s) => s.overlays);
  const setBaseLayer = useMapStore((s) => s.setBaseLayer);
  const setOverlays = useMapStore((s) => s.setOverlays);

  const hydratedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const lat = parseFloatOrNull(searchParams.get("lat"));
    const lon = parseFloatOrNull(searchParams.get("lon"));
    const z = parseFloatOrNull(searchParams.get("z"));
    const base = searchParams.get("base");
    const overlaysParam = parseOverlays(searchParams.get("overlays"));

    if (lat !== null && lon !== null) {
      map.setView([lat, lon], z ?? map.getZoom());
    }
    if (base && isLayerId(base) && base !== baseLayer) {
      setBaseLayer(base);
    }
    if (overlaysParam !== null) {
      setOverlays(overlaysParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Write store layer state to the URL on change. Map center/zoom is written
  // by the moveend/zoomend handler below.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const params = new URLSearchParams(searchParams);
    params.set("base", baseLayer);
    if (overlays.size > 0) params.set("overlays", [...overlays].join(","));
    else params.delete("overlays");
    setSearchParams(params, { replace: true });
    // searchParams changes on every URL write — leaving it out is intentional
    // so we don't loop through this effect after our own update lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLayer, overlays, setSearchParams]);

  useMapEvents({
    moveend() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const c = map.getCenter();
        const params = new URLSearchParams(window.location.search);
        params.set("lat", c.lat.toFixed(5));
        params.set("lon", c.lng.toFixed(5));
        params.set("z", String(map.getZoom()));
        setSearchParams(params, { replace: true });
      }, DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return null;
}
