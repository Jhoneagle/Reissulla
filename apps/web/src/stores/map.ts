import { create } from "zustand";
import {
  isLayerId,
  type GeocodingResult,
  type LayerDefaults,
  type LayerId,
} from "@reissulla/shared";
import { DEFAULT_BASE_LAYER, DEFAULT_OVERLAYS } from "../components/map/layers";

const STORAGE_KEY = "reissulla:mapState";

interface SelectedLocation {
  lat: number;
  lon: number;
  name?: string;
}

export type MapView = "map" | "list";

interface PersistedMapState {
  baseLayer: LayerId;
  overlays: LayerId[];
  followMe: boolean;
}

interface MapStore {
  selectedLocation: SelectedLocation | null;
  searchResults: GeocodingResult[];
  baseLayer: LayerId;
  overlays: Set<LayerId>;
  followMe: boolean;
  view: MapView;
  selectLocation: (location: SelectedLocation) => void;
  clearSelection: () => void;
  setSearchResults: (results: GeocodingResult[]) => void;
  setBaseLayer: (id: LayerId) => void;
  toggleOverlay: (id: LayerId) => void;
  setOverlays: (ids: readonly LayerId[]) => void;
  setFollowMe: (on: boolean) => void;
  setView: (view: MapView) => void;
  hydrateFromPreferences: (defaults: LayerDefaults | undefined) => void;
}

function loadFromStorage(): PersistedMapState {
  const fallback: PersistedMapState = {
    baseLayer: DEFAULT_BASE_LAYER,
    overlays: [...DEFAULT_OVERLAYS],
    followMe: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const p = parsed as Record<string, unknown>;
    const baseLayer = isLayerId(p.baseLayer) ? p.baseLayer : fallback.baseLayer;
    const overlays = Array.isArray(p.overlays)
      ? p.overlays.filter(isLayerId)
      : fallback.overlays;
    const followMe = p.followMe === true;
    return { baseLayer, overlays, followMe };
  } catch {
    return fallback;
  }
}

function persist(state: PersistedMapState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode — ignore
  }
}

const initial = loadFromStorage();

export const useMapStore = create<MapStore>((set, get) => ({
  selectedLocation: null,
  searchResults: [],
  baseLayer: initial.baseLayer,
  overlays: new Set(initial.overlays),
  followMe: initial.followMe,
  view: "map",

  selectLocation: (location) => set({ selectedLocation: location }),
  clearSelection: () => set({ selectedLocation: null }),
  setSearchResults: (results) => set({ searchResults: results }),

  setBaseLayer: (id) => {
    set({ baseLayer: id });
    const s = get();
    persist({ baseLayer: id, overlays: [...s.overlays], followMe: s.followMe });
  },

  toggleOverlay: (id) => {
    const next = new Set(get().overlays);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ overlays: next });
    const s = get();
    persist({
      baseLayer: s.baseLayer,
      overlays: [...next],
      followMe: s.followMe,
    });
  },

  setOverlays: (ids) => {
    const next = new Set<LayerId>(ids);
    set({ overlays: next });
    const s = get();
    persist({
      baseLayer: s.baseLayer,
      overlays: [...next],
      followMe: s.followMe,
    });
  },

  setFollowMe: (on) => {
    set({ followMe: on });
    const s = get();
    persist({
      baseLayer: s.baseLayer,
      overlays: [...s.overlays],
      followMe: on,
    });
  },

  setView: (view) => set({ view }),

  // Auth merge rule: server prefs win. Anon localStorage is overwritten so the
  // next anon session inherits the signed-in user's last layer choice.
  hydrateFromPreferences: (defaults) => {
    if (!defaults) return;
    const overlays = new Set<LayerId>(defaults.overlays);
    set({ baseLayer: defaults.baseLayer, overlays });
    persist({
      baseLayer: defaults.baseLayer,
      overlays: defaults.overlays,
      followMe: get().followMe,
    });
  },
}));
