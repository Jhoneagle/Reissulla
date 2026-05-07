export interface GeocodingResult {
  placeId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string;
  importance: number;
  /** City / municipality name (e.g. "Helsinki") */
  locality?: string;
  /** Neighbourhood name (e.g. "Savela") */
  neighbourhood?: string;
}

export interface ReverseGeocodingResult {
  placeId: string;
  name: string;
  displayName: string;
  address: {
    road?: string;
    houseNumber?: string;
    city?: string;
    neighbourhood?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
  latitude: number;
  longitude: number;
}
