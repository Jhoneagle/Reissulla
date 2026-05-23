import type { TransitStop } from "@reissulla/shared";
import { config } from "../../config.js";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { tryCache } from "../../utils/resilience.js";
import { defaultAdapter } from "../../adapters/digitransit-routing/dispatch.js";
import type { AdapterContext } from "../../adapters/types.js";
import { groupStopsByNameAndMode } from "./grouping.js";

const STOPS_CACHE_TTL = 3600;
const GEOCODE_CACHE_TTL = 86400;
const GEOCODE_TIMEOUT_MS = 5_000;

const GEOCODING_URL = "https://api.digitransit.fi/geocoding/v1/reverse";

const KNOWN_MODES = new Set(["BUS", "TRAM", "RAIL", "SUBWAY", "FERRY"]);

function apiKeyHeaders(): Record<string, string> {
  return config.digitransitApiKey
    ? { "digitransit-subscription-key": config.digitransitApiKey }
    : {};
}

function makeContext(): AdapterContext {
  return { signal: new AbortController().signal };
}

async function reverseGeocodeCity(
  lat: number,
  lon: number,
): Promise<string | undefined> {
  const rLat = lat.toFixed(3);
  const rLon = lon.toFixed(3);
  const key = `transit:geocode:${rLat}:${rLon}`;

  const cached = await tryCache(() => cacheGet<string>(key));
  if (cached) return cached;

  try {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set("point.lat", rLat);
    url.searchParams.set("point.lon", rLon);
    url.searchParams.set("size", "1");

    const res = await fetch(url, {
      headers: apiKeyHeaders(),
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;

    const json = await res.json();
    const city: string | undefined =
      json?.features?.[0]?.properties?.locality ??
      json?.features?.[0]?.properties?.name;

    if (city) {
      await tryCache(() => cacheSet(key, city, GEOCODE_CACHE_TTL));
    }
    return city;
  } catch {
    return undefined;
  }
}

async function enrichStopsWithCity(stops: TransitStop[]): Promise<void> {
  const coordToStops = new Map<string, TransitStop[]>();
  for (const stop of stops) {
    const coordKey = `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`;
    const list = coordToStops.get(coordKey) ?? [];
    list.push(stop);
    coordToStops.set(coordKey, list);
  }

  await Promise.all(
    Array.from(coordToStops.entries()).map(async ([, group]) => {
      const city = await reverseGeocodeCity(group[0]!.lat, group[0]!.lon);
      if (city) {
        for (const stop of group) {
          stop.city = city;
        }
      }
    }),
  );
}

export async function getNearbyStops(
  lat: number,
  lon: number,
  radiusMeters = 500,
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const key = `transit:stops-nearby:${lat.toFixed(3)}:${lon.toFixed(3)}:${radiusMeters}`;
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = defaultAdapter();
  const edges = await adapter.nearest(lat, lon, radiusMeters, makeContext());

  const data: TransitStop[] = edges.map((edge) => ({
    gtfsId: edge.place.gtfsId,
    name: edge.place.name,
    code: edge.place.code,
    lat: edge.place.lat,
    lon: edge.place.lon,
    vehicleMode: edge.place.vehicleMode,
    platformCode: edge.place.platformCode,
    distance: edge.distance,
  }));

  await tryCache(() => cacheSet(key, data, STOPS_CACHE_TTL));
  return { data, cached: false };
}

export async function searchStops(
  query: string,
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const key = `transit:stops-search:${query.toLowerCase()}`;
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = defaultAdapter();
  const raw = await adapter.searchStopsAndStations(query, makeContext());

  const grouped = groupStopsByNameAndMode(raw.stops, raw.stations);

  const data = grouped.filter(
    (s) => s.vehicleMode !== null && KNOWN_MODES.has(s.vehicleMode),
  );

  await enrichStopsWithCity(data);

  await tryCache(() => cacheSet(key, data, STOPS_CACHE_TTL));
  return { data, cached: false };
}
