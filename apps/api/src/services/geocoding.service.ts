import type {
  GeocodingResult,
  ReverseGeocodingResult,
} from "@reissulla/shared";
import { config } from "../config.js";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { tryCache } from "../utils/resilience.js";

const DIGITRANSIT_BASE = "https://api.digitransit.fi/geocoding/v1";
const CACHE_TTL = 24 * 60 * 60; // 24 hours
const FETCH_TIMEOUT_MS = 10_000;

/** Pelias GeoJSON feature shape (subset we use). */
interface PeliasFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] }; // [lon, lat]
  properties: {
    id: string;
    gid: string;
    layer: string;
    source: string;
    name: string;
    label: string;
    confidence?: number;
    accuracy?: string;
    country?: string;
    region?: string;
    locality?: string;
    neighbourhood?: string;
    street?: string;
    housenumber?: string;
    postalcode?: string;
  };
}

interface PeliasResponse {
  type: "FeatureCollection";
  features: PeliasFeature[];
}

interface FocusPoint {
  lat: number;
  lon: number;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {};
  if (config.digitransitApiKey) {
    h["digitransit-subscription-key"] = config.digitransitApiKey;
  }
  return h;
}

function toResult(f: PeliasFeature): GeocodingResult {
  return {
    placeId: f.properties.gid,
    name: f.properties.name,
    displayName: f.properties.label,
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    type: f.properties.layer,
    importance: f.properties.confidence ?? 0,
    locality: f.properties.locality,
    neighbourhood: f.properties.neighbourhood,
  };
}

/** Remove duplicates with the same name + locality (e.g. same street listed twice). */
function dedup(results: GeocodingResult[]): GeocodingResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.name}::${r.locality ?? ""}::${r.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Detect if query looks like a specific address (contains a number). */
function looksLikeAddress(query: string): boolean {
  return /\d/.test(query);
}

export async function searchGeocode(
  query: string,
  focus?: FocusPoint,
): Promise<{ data: GeocodingResult[]; cached: boolean }> {
  const focusSuffix = focus ? `:${focus.lat.toFixed(1)}:${focus.lon.toFixed(1)}` : "";
  const key = `geocoding:search:${query.toLowerCase()}${focusSuffix}`;
  const cached = await tryCache(() => cacheGet<GeocodingResult[]>(key));
  if (cached) return { data: cached, cached: true };

  const params = new URLSearchParams({
    text: query,
    size: "10",
    "boundary.country": "FI",
    lang: "fi",
  });

  if (focus) {
    params.set("focus.point.lat", String(focus.lat));
    params.set("focus.point.lon", String(focus.lon));
  }

  // Use /search for address-like queries (better at matching house numbers),
  // /autocomplete for everything else (better partial/prefix matching).
  const endpoint = looksLikeAddress(query) ? "search" : "autocomplete";
  const url = `${DIGITRANSIT_BASE}/${endpoint}?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(
      `Digitransit geocoding error: ${res.status} ${res.statusText}`,
    );
  }

  const raw: PeliasResponse = await res.json();
  const data = dedup(raw.features.map(toResult));

  await tryCache(() => cacheSet(key, data, CACHE_TTL));
  return { data, cached: false };
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ data: ReverseGeocodingResult; cached: boolean }> {
  const key = `geocoding:reverse:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const cached = await tryCache(() => cacheGet<ReverseGeocodingResult>(key));
  if (cached) return { data: cached, cached: true };

  const params = new URLSearchParams({
    "point.lat": String(lat),
    "point.lon": String(lon),
    size: "1",
    lang: "fi",
  });
  const url = `${DIGITRANSIT_BASE}/reverse?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(
      `Digitransit reverse geocoding error: ${res.status} ${res.statusText}`,
    );
  }

  const raw: PeliasResponse = await res.json();

  if (raw.features.length === 0) {
    throw new Error("No results for reverse geocoding");
  }

  const f = raw.features[0]!;
  const p = f.properties;

  const data: ReverseGeocodingResult = {
    placeId: p.gid,
    name: p.name,
    displayName: p.label,
    address: {
      road: p.street,
      houseNumber: p.housenumber,
      city: p.locality,
      county: p.region,
      postcode: p.postalcode,
      country: p.country,
      neighbourhood: p.neighbourhood,
    },
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
  };

  await tryCache(() => cacheSet(key, data, CACHE_TTL));
  return { data, cached: false };
}
