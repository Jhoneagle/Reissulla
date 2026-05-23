export type SavedLocationCategory =
  | "home"
  | "work"
  | "school"
  | "cottage"
  | "family"
  | "hobby"
  | "other";

export interface SavedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
  sortOrder: number;
  region: string | null;
  category: SavedLocationCategory | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  latitude: number;
  longitude: number;
  category?: SavedLocationCategory;
}

export interface UpdateLocationInput {
  name?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  category?: SavedLocationCategory | null;
}

export interface RecentPlace {
  id: string;
  latitude: number;
  longitude: number;
  displayName: string;
  visitCount: number;
  lastVisitedAt: string;
}

export interface RecordVisitInput {
  latitude: number;
  longitude: number;
  displayName: string;
}
