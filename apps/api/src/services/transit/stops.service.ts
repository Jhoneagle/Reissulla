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
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { patternsOperation } from "../../adapters/digitransit-routing/operations/patterns.js";
import { routesOperation } from "../../adapters/digitransit-routing/operations/routes.js";
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

export interface NearbyOptions {
  /** Filter to a single vehicle mode (BUS / TRAM / RAIL / SUBWAY / FERRY). */
  mode?: string;
}

export async function getNearbyStops(
  lat: number,
  lon: number,
  radiusMeters = 500,
  persona: Persona = DEFAULT_PERSONA,
  options: NearbyOptions = {},
): Promise<{ data: TransitStop[]; cached: boolean }> {
  // Mode is appended only when set so a no-mode query keeps hitting the
  // existing v1 cache slot — no version bump needed.
  const segments: (string | number)[] = [
    lat.toFixed(3),
    lon.toFixed(3),
    radiusMeters,
  ];
  if (options.mode) segments.push(options.mode);
  // v2 — added enriched `city` on each stop (Chunk 7 FIN-1).
  const key = cacheKey("transit", "stops-nearby", 2, ...segments);
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forCoordinate(lat, lon);
  const edges = await adapter.nearest(
    lat,
    lon,
    radiusMeters,
    makeContext(persona),
  );

  let data: TransitStop[] = edges.map((edge) => ({
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

  if (options.mode) {
    data = data.filter((s) => s.vehicleMode === options.mode);
  }

  // City labels under each nearby stop disambiguate cross-region results
  // ("Pasila, Helsinki" vs "Pasila, Tampere") and let the dashboard
  // primary card show the locality even when the user is travelling.
  await enrichStopsWithCity(data);

  sortAccessibleFirstIfPersona(data, persona);

  await tryCache(() => cacheSet(key, data, STOPS_TTL));
  return { data, cached: false };
}

const ADAPTIVE_RADII = [500, 1000, 2000] as const;
const ADAPTIVE_TARGET_COUNT = 5;

/**
 * Adaptive nearby search — starts at 500 m, doubles up to 2 km until at
 * least five stops surface. Returns the radius actually used so the FE can
 * tell the user "expanded search to 1.2 km" rather than silently widening.
 */
export async function getAdaptiveNearbyStops(
  lat: number,
  lon: number,
  persona: Persona = DEFAULT_PERSONA,
  options: NearbyOptions = {},
): Promise<{ data: TransitStop[]; cached: boolean; radiusUsed: number }> {
  let lastData: TransitStop[] = [];
  let lastCached = false;
  let radiusUsed: number = ADAPTIVE_RADII[0];
  for (const radius of ADAPTIVE_RADII) {
    const { data, cached } = await getNearbyStops(
      lat,
      lon,
      radius,
      persona,
      options,
    );
    lastData = data;
    lastCached = cached;
    radiusUsed = radius;
    if (data.length >= ADAPTIVE_TARGET_COUNT) break;
  }
  return { data: lastData, cached: lastCached, radiusUsed };
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

export interface SearchOptions {
  mode?: string;
  /** Locality filter — matches TransitStop.city (case-insensitive). */
  region?: string;
  /** Line shortname — returns the stops served by that line instead. */
  byLine?: string;
  /** Operator filter — matches one of the agencies serving the stop. */
  operator?: string;
}

export async function searchStops(
  query: string,
  persona: Persona = DEFAULT_PERSONA,
  options: SearchOptions = {},
): Promise<{ data: TransitStop[]; cached: boolean }> {
  if (options.byLine) {
    return getStopsByLine(options.byLine, persona, {
      region: options.region,
      mode: options.mode,
    });
  }

  const segments: string[] = [query.toLowerCase()];
  if (options.mode) segments.push(options.mode);
  if (options.region) segments.push(`region=${options.region.toLowerCase()}`);
  if (options.operator) {
    segments.push(`op=${options.operator.toLowerCase()}`);
  }
  const key = cacheKey("transit", "stops-search", 1, ...segments);
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forSearch();
  const raw = await adapter.searchStopsAndStations(query, makeContext(persona));

  const grouped = groupStopsByNameAndMode(raw.stops, raw.stations);

  let data = grouped.filter(
    (s) => s.vehicleMode !== null && KNOWN_MODES.has(s.vehicleMode),
  );

  if (options.mode) {
    data = data.filter((s) => s.vehicleMode === options.mode);
  }

  await enrichStopsWithCity(data);

  if (options.region) {
    const wanted = options.region.toLowerCase();
    data = data.filter((s) => s.city?.toLowerCase() === wanted);
  }

  if (options.operator) {
    const wantedId = options.operator;
    const wantedName = options.operator.toLowerCase();
    data = data.filter((s) =>
      s.agencies?.some(
        (a) => a.gtfsId === wantedId || a.name.toLowerCase() === wantedName,
      ),
    );
  }

  sortAccessibleFirstIfPersona(data, persona);

  await tryCache(() => cacheSet(key, data, STOPS_TTL));
  return { data, cached: false };
}

/**
 * Stops served by a transit line, addressed by short name (e.g. "550").
 *
 * Resolves the route ids via `routes(name)`, walks each matching route's
 * pattern stop list, and deduplicates by gtfsId. Cross-region matches —
 * Tampere bus 25 vs Helsinki bus 25 — both surface; the region option
 * narrows to one city via the enriched city label.
 */
export async function getStopsByLine(
  lineShortName: string,
  persona: Persona = DEFAULT_PERSONA,
  options: { region?: string; mode?: string } = {},
): Promise<{ data: TransitStop[]; cached: boolean }> {
  const trimmed = lineShortName.trim();
  const segments: string[] = [trimmed.toLowerCase()];
  if (options.region) segments.push(`region=${options.region.toLowerCase()}`);
  if (options.mode) segments.push(options.mode);
  const key = cacheKey("transit", "stops-by-line", 1, ...segments);
  const cached = await tryCache(() => cacheGet<TransitStop[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forSearch();
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx = makeContext(persona);

  const routes = await routesOperation(client, { name: trimmed }, ctx);
  const exactMatches = routes.filter((r) => r.shortName === trimmed);

  if (exactMatches.length === 0) {
    await tryCache(() => cacheSet(key, [], STOPS_TTL));
    return { data: [], cached: false };
  }

  const seen = new Map<string, TransitStop>();
  for (const route of exactMatches) {
    if (options.mode && route.mode !== options.mode) continue;
    const patterns = await patternsOperation(
      client,
      { routeId: route.gtfsId },
      ctx,
    );
    for (const pattern of patterns) {
      for (const stop of pattern.stops) {
        if (seen.has(stop.gtfsId)) continue;
        seen.set(stop.gtfsId, {
          gtfsId: stop.gtfsId,
          name: stop.name,
          code: stop.code,
          lat: stop.lat,
          lon: stop.lon,
          vehicleMode: route.mode,
          platformCode: stop.platformCode,
        });
      }
    }
  }

  let data = Array.from(seen.values());
  await enrichStopsWithCity(data);

  if (options.region) {
    const wanted = options.region.toLowerCase();
    data = data.filter((s) => s.city?.toLowerCase() === wanted);
  }

  sortAccessibleFirstIfPersona(data, persona);

  await tryCache(() => cacheSet(key, data, STOPS_TTL));
  return { data, cached: false };
}
