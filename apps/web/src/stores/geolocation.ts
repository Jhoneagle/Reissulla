import { create } from "zustand";

const STORAGE_KEY = "reissulla:lastPosition";

interface Position {
  lat: number;
  lon: number;
}

interface GeolocationStore {
  position: Position | null;
  loading: boolean;
  denied: boolean;
  requestPosition: () => void;
}

function loadCachedPosition(): Position | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Position;
  } catch {
    // ignore
  }
  return null;
}

function cachePosition(pos: Position) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export const useGeolocationStore = create<GeolocationStore>((set, get) => ({
  position: loadCachedPosition(),
  loading: false,
  denied: false,

  requestPosition: () => {
    if (!navigator.geolocation) {
      set({ loading: false });
      return;
    }

    if (get().loading) return;

    set({ loading: true, denied: false });

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const pos = {
          lat: result.coords.latitude,
          lon: result.coords.longitude,
        };
        cachePosition(pos);
        set({ position: pos, loading: false, denied: false });
      },
      (error) => {
        set({
          loading: false,
          denied: error.code === error.PERMISSION_DENIED,
        });
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  },
}));
