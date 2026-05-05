import type {
  GeocodingResult,
  ReverseGeocodingResult,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { tryCache } from "../utils/resilience.js";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const CACHE_TTL = 24 * 60 * 60; // 24 hours
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Reissulla/1.0 (https://github.com/Jhoneagle/Reissulla)";
const MIN_REQUEST_INTERVAL_MS = 1100;

// Promise chain serializes requests; only delays when needed
let pending: Promise<void> = Promise.resolve();
let lastRequestTime = 0;

function throttle(): Promise<void> {
  pending = pending.then(async () => {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((r) =>
        setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed),
      );
    }
    lastRequestTime = Date.now();
  });
  return pending;
}

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

interface NominatimReverseResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  error?: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

export async function searchGeocode(
  query: string,
): Promise<{ data: GeocodingResult[]; cached: boolean }> {
  const key = `geocoding:search:${query.toLowerCase()}`;
  const cached = await tryCache(() => cacheGet<GeocodingResult[]>(key));
  if (cached) return { data: cached, cached: true };

  await throttle();

  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
  });
  const url = `${NOMINATIM_BASE}/search?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Nominatim API error: ${res.status} ${res.statusText}`);
  }

  const raw: NominatimSearchResult[] = await res.json();

  const data: GeocodingResult[] = raw.map((r) => ({
    placeId: r.place_id,
    name: r.name ?? r.display_name.split(",")[0]!,
    displayName: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    type: r.type,
    importance: r.importance,
  }));

  await tryCache(() => cacheSet(key, data, CACHE_TTL));
  return { data, cached: false };
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ data: ReverseGeocodingResult; cached: boolean }> {
  const key = `geocoding:reverse:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = await tryCache(() => cacheGet<ReverseGeocodingResult>(key));
  if (cached) return { data: cached, cached: true };

  await throttle();

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    addressdetails: "1",
  });
  const url = `${NOMINATIM_BASE}/reverse?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Nominatim API error: ${res.status} ${res.statusText}`);
  }

  const raw: NominatimReverseResult = await res.json();

  if (raw.error) {
    throw new Error(`Nominatim: ${raw.error}`);
  }

  const data: ReverseGeocodingResult = {
    placeId: raw.place_id,
    name: raw.name ?? raw.display_name.split(",")[0]!,
    displayName: raw.display_name,
    address: {
      road: raw.address.road,
      houseNumber: raw.address.house_number,
      city: raw.address.city,
      municipality: raw.address.municipality,
      county: raw.address.county,
      state: raw.address.state,
      postcode: raw.address.postcode,
      country: raw.address.country,
      countryCode: raw.address.country_code,
    },
    latitude: Number(raw.lat),
    longitude: Number(raw.lon),
  };

  await tryCache(() => cacheSet(key, data, CACHE_TTL));
  return { data, cached: false };
}

export function _resetThrottle(): void {
  pending = Promise.resolve();
  lastRequestTime = 0;
}
