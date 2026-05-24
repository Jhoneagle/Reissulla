import type {
  GeocodingResult,
  ReverseGeocodingResult,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import { GEOCODE_SEARCH_TTL, GEOCODE_REVERSE_TTL } from "../cache/ttl.js";
import { tryCache } from "../utils/resilience.js";
import { digitransitPelias } from "../adapters/digitransit-pelias/index.js";
import type { PeliasFeature } from "../adapters/digitransit-pelias/client.js";
import type { AdapterContext } from "../adapters/types.js";

interface FocusPoint {
  lat: number;
  lon: number;
}

function makeContext(): AdapterContext {
  return { signal: new AbortController().signal };
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

/** Remove duplicates by name + locality, keeping the first occurrence. */
function dedup(results: GeocodingResult[]): GeocodingResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    // Collapse entries with same name in same city (e.g. multiple "Helsinki" stations)
    const key = `${r.name}::${r.locality ?? ""}`;
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
  const key = focus
    ? cacheKey(
        "geocoding",
        "search",
        1,
        query.toLowerCase(),
        focus.lat.toFixed(1),
        focus.lon.toFixed(1),
      )
    : cacheKey("geocoding", "search", 1, query.toLowerCase());
  const cached = await tryCache(() => cacheGet<GeocodingResult[]>(key));
  if (cached) return { data: cached, cached: true };

  const ctx = makeContext();
  let data: GeocodingResult[];

  if (looksLikeAddress(query)) {
    // Address queries: /search is better at matching house numbers.
    const features = await digitransitPelias.search(
      { text: query, size: 10, focus },
      ctx,
    );
    data = dedup(features.map(toResult));
  } else {
    // Non-address queries: fire two requests in parallel — one general
    // autocomplete and one for localities/stations only. This ensures
    // cities like "Helsinki" appear alongside street results when typing
    // "Hels", similar to how Google Maps mixes result types.
    const [generalFeatures, placeFeatures] = await Promise.all([
      digitransitPelias.autocomplete({ text: query, size: 8, focus }, ctx),
      digitransitPelias
        .autocomplete(
          { text: query, size: 3, focus, layers: "localadmin,station" },
          ctx,
        )
        .catch(() => [] as PeliasFeature[]),
    ]);

    // Merge: place results first, then general results, deduplicated.
    const merged = [
      ...placeFeatures.map(toResult),
      ...generalFeatures.map(toResult),
    ];
    data = dedup(merged).slice(0, 10);
  }

  await tryCache(() => cacheSet(key, data, GEOCODE_SEARCH_TTL));
  return { data, cached: false };
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ data: ReverseGeocodingResult; cached: boolean }> {
  const key = cacheKey(
    "geocoding",
    "reverse",
    1,
    lat.toFixed(4),
    lon.toFixed(4),
  );
  const cached = await tryCache(() => cacheGet<ReverseGeocodingResult>(key));
  if (cached) return { data: cached, cached: true };

  const features = await digitransitPelias.reverse(
    { lat, lon, size: 1 },
    makeContext(),
  );

  if (features.length === 0) {
    throw new Error("No results for reverse geocoding");
  }

  const f = features[0]!;
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

  await tryCache(() => cacheSet(key, data, GEOCODE_REVERSE_TTL));
  return { data, cached: false };
}
