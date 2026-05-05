export interface GeocodingResult {
  placeId: number;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string;
  importance: number;
}

export interface ReverseGeocodingResult {
  placeId: number;
  name: string;
  displayName: string;
  address: {
    road?: string;
    houseNumber?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
  latitude: number;
  longitude: number;
}
