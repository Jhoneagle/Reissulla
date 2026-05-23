import { FINLAND_CENTER } from "@reissulla/shared";
import { useGeolocationStore } from "../stores/geolocation";

const LAST_VIEWED_KEY = "reissulla:map:last-viewed";
const DEFAULT_ZOOM = 13;
const FINLAND_ZOOM = 5;

interface LastViewed {
  lat: number;
  lon: number;
  zoom: number;
  savedAt: number;
}

function readLastViewed(): LastViewed | null {
  try {
    const raw = localStorage.getItem(LAST_VIEWED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastViewed>;
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lon === "number" &&
      typeof parsed.zoom === "number"
    ) {
      return parsed as LastViewed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLastViewed(lat: number, lon: number, zoom: number): void {
  try {
    localStorage.setItem(
      LAST_VIEWED_KEY,
      JSON.stringify({ lat, lon, zoom, savedAt: Date.now() }),
    );
  } catch {
    // localStorage may be full or unavailable (private mode); silently ignore
  }
}

export type DefaultCenterSource =
  | "gps"
  | "primary-saved"
  | "last-viewed"
  | "finland-bounds";

export interface DefaultCenter {
  center: [number, number];
  zoom: number;
  source: DefaultCenterSource;
}

/**
 * Cascade: GPS → primary saved → last viewed → Finland bounds.
 *
 * The primary-saved slot is reserved for Phase 1 and currently always
 * falls through to last-viewed.
 */
export function useDefaultCenter(): DefaultCenter {
  const geoPosition = useGeolocationStore((s) => s.position);

  if (geoPosition) {
    return {
      center: [geoPosition.lat, geoPosition.lon],
      zoom: DEFAULT_ZOOM,
      source: "gps",
    };
  }

  // TODO Phase 1: read user's primary saved location from preferences

  const lastViewed = readLastViewed();
  if (lastViewed) {
    return {
      center: [lastViewed.lat, lastViewed.lon],
      zoom: lastViewed.zoom,
      source: "last-viewed",
    };
  }

  return {
    center: [FINLAND_CENTER.lat, FINLAND_CENTER.lon],
    zoom: FINLAND_ZOOM,
    source: "finland-bounds",
  };
}
