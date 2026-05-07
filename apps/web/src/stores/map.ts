import { create } from "zustand";
import type { GeocodingResult } from "@reissulla/shared";

interface SelectedLocation {
  lat: number;
  lon: number;
  name?: string;
}

interface MapStore {
  selectedLocation: SelectedLocation | null;
  searchResults: GeocodingResult[];
  selectLocation: (location: SelectedLocation) => void;
  clearSelection: () => void;
  setSearchResults: (results: GeocodingResult[]) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  selectedLocation: null,
  searchResults: [],
  selectLocation: (location) => set({ selectedLocation: location }),
  clearSelection: () => set({ selectedLocation: null }),
  setSearchResults: (results) => set({ searchResults: results }),
}));
