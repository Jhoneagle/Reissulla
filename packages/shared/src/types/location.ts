export interface SavedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  latitude: number;
  longitude: number;
}

export interface UpdateLocationInput {
  name?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}
