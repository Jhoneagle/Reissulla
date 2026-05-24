import {
  DEFAULT_PERSONA,
  type Persona,
  type TransitStop,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { STOPS_TTL, GEOCODE_REVERSE_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { digitransitPelias } from "../../adapters/digitransit-pelias/index.js";
import type { AdapterContext } from "../../adapters/types.js";
import { adapterRouter } from "./adapter-router.js";
import { groupStopsByNameAndMode } from "./grouping.js";

const ENRICH_MAX_PARALLEL = 10;

const KNOWN_MODES = new Set(["BUS", "TRAM", "RAIL", "SUBWAY", "FERRY"]);

function makeContext(persona: Persona): AdapterContext {
  return { signal: new AbortController().signal, persona };
}

async function reverseGeocodeCity(
  lat: number,
  lon: number,
): Promise<string | undefined> {
  const rLat = lat.toFixed(3);
  const rLon = lon.toFixed(3);
  // Distinct entity from geocoding:reverse (which stores a full
  // ReverseGeocodingResult) — this slot only ever holds the city name string.
  // Same Pelias upstream, different cached value shape, so we never want a
  // collision even if precisions converge.
  const key = cacheKey("geocoding", "reverse-city", 1, rLat, rLon);

  const cached = await tryCache(() => cacheGet<string>(key));
  if (cached) return cached;

  try {
    const features = await digitransitPelias.reverse(
      { lat: Number(rLat), lon: Number(rLon), size: 1 },
      { signal: new AbortController().signal },
    );
    const props = features[0]?.properties;
    const city: string | undefined = props?.locality ?? props?.name;

    if (city) {
      await tryCache(() => cacheSet(key, city, GEOCODE_REVERSE_TTL));
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

  // Cap parallelism so a large search doesn't fan out to dozens of
  // simultaneous Pelias requests against a shared upstream.
  const groups = Array.from(coordToStops.values());
  for (let i = 0; i < groups.length; i += ENRICH_MAX_PARALLEL) {
    const batch = groups.slice(i, i + ENRICH_MAX_PARALLEL);
    await Promise.all(
      batch.map(async (group) => {
        const city = await reverseGeocodeCity(group[0]!.lat, group[0]!.lon);
        if (city) {
          for (const stop of group) {
            stop.city = city;
          }
        }
      }),
    );
  }
}

export async function getNearbyStops(
  lat: number,
  lon: number,
  radiusMeters = 500,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const key = cacheKey(
    "transit",
    "stops-nearby",
    1,
    lat.toFixed(3),
    lon.toFixed(3),
    radiusMeters,
  );
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forCoordinate(lat, lon);
  const edges = await adapter.nearest(
    lat,
    lon,
    radiusMeters,
    makeContext(persona),
  );

  const data: TransitStop[] = edges.map((edge) => ({
    gtfsId: edge.place.gtfsId,
    name: edge.place.name,
    code: edge.place.code,
    lat: edge.place.lat,
    lon: edge.place.lon,
    vehicleMode: edge.place.vehicleMode,
    platformCode: edge.place.platformCode,
    distance: edge.distance,
    wheelchairBoarding: edge.place.wheelchairBoarding ?? undefined,
  }));

  sortAccessibleFirstIfPersona(data, persona);

  await tryCache(() => cacheSet(key, data, STOPS_TTL));
  return { data, cached: false };
}

/**
 * When the persona wants accessibility prioritised, lift POSSIBLE rows to
 * the top of the list. NO_INFORMATION stays in its original position so
 * the user still sees feed-uncertain stops without burying them.
 */
function sortAccessibleFirstIfPersona(
  stops: TransitStop[],
  persona: Persona,
): void {
  if (!persona.wheelchair && !persona.noStairs) return;
  stops.sort((a, b) => {
    const accA = a.wheelchairBoarding === "POSSIBLE" ? 1 : 0;
    const accB = b.wheelchairBoarding === "POSSIBLE" ? 1 : 0;
    return accB - accA;
  });
}

export async function searchStops(
  query: string,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const key = cacheKey("transit", "stops-search", 1, query.toLowerCase());
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forSearch();
  const raw = await adapter.searchStopsAndStations(query, makeContext(persona));

  const grouped = groupStopsByNameAndMode(raw.stops, raw.stations);

  const data = grouped.filter(
    (s) => s.vehicleMode !== null && KNOWN_MODES.has(s.vehicleMode),
  );

  await enrichStopsWithCity(data);

  sortAccessibleFirstIfPersona(data, persona);

  await tryCache(() => cacheSet(key, data, STOPS_TTL));
  return { data, cached: false };
}
