import {
  DEFAULT_PERSONA,
  serviceDayFromUnix,
  type Persona,
  type ServiceDay,
  type TransitDeparture,
  type TransitDeparturesResult,
  type TransitSubStop,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { DEPARTURES_V2_TTL, SERVICE_RANGE_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import type { AdapterContext } from "../../adapters/types.js";
import type { RawStoptime } from "../../adapters/digitransit-routing/types.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { stoptimesForDateOperation } from "../../adapters/digitransit-routing/operations/stoptimesForDate.js";
import { adapterRouter } from "./adapter-router.js";
import {
  classifyFrequency,
  getServiceNoteForTrip,
} from "./frequency.service.js";
import {
  classifyRailHeadsign,
  type RailDirectionLabel,
} from "./rail-direction.js";

/**
 * DEP-3 — minimum departures across distinguishable directions for the
 * inbound/outbound split to engage. Below this we skip clustering and
 * the FE renders the flat list (one direction's worth of trips reads
 * fine as a single column).
 */
const RAIL_DIRECTION_MIN_TOTAL = 4;
const RAIL_DIRECTION_MIN_PER_BUCKET = 2;

const MAX_PARALLEL_STOP_QUERIES = 10;
/**
 * Upstream fetch buffer — we always fetch the unfiltered superset and then
 * filter post-cache (see the cache-source-filter-at-edge principle in
 * `feedback_cache_source_filter_at_edge`). Asking for 1.5× the FE's
 * displayed count leaves room for low-floor / line / direction filters to
 * thin the result without falling short.
 */
const FETCH_BUFFER = 1.5;

export type ArrivalDepartureMode = "departures" | "arrivals" | "both";

export interface DeparturesOptions {
  /** Unix seconds — future-time picker (DEP-4). */
  at?: number;
  /** DEP-2 — three-way toggle on `kind` derived from `pickupType`. */
  mode?: ArrivalDepartureMode;
  /** DEP-5 — `routeShortName` allow-list. */
  lineFilter?: string[];
  /** DEP-6 — case-insensitive headsign substring. */
  directionFilter?: string;
  /** A11Y-19 — keep only trips with wheelchairAccessible === POSSIBLE. */
  lowFloorOnly?: boolean;
}

function makeContext(persona: Persona): AdapterContext {
  return {
    signal: new AbortController().signal,
    locale: persona.language,
    persona,
  };
}

function mapStoptimes(stoptimes: RawStoptime[]): TransitDeparture[] {
  return stoptimes.map((st) => ({
    routeShortName: st.trip.route.shortName,
    routeLongName: st.trip.route.longName,
    routeGtfsId: st.trip.route.gtfsId,
    headsign: st.headsign,
    scheduledArrival: st.scheduledArrival,
    realtimeArrival: st.realtimeArrival,
    arrivalDelay: st.arrivalDelay,
    scheduledDeparture: st.scheduledDeparture,
    realtimeDeparture: st.realtimeDeparture,
    departureDelay: st.departureDelay,
    realtime: st.realtime,
    serviceDay: st.serviceDay,
    vehicleMode: st.trip.route.mode,
    stopId: st.stop?.gtfsId,
    platformCode: st.stop?.platformCode ?? st.stop?.code ?? null,
    tripId: st.trip.gtfsId,
    wheelchairAccessible: st.trip.wheelchairAccessible ?? undefined,
    directionId: st.trip.directionId ?? undefined,
    // pickupType / dropoffType === NONE flag the event as unavailable
    // at this stop. At through-stops both are SCHEDULED — the same row
    // represents both an arrival and a departure for the same vehicle.
    canBoard: st.pickupType === "NONE" ? false : true,
    canAlight: st.dropoffType === "NONE" ? false : true,
  }));
}

/**
 * Cluster RAIL departures into inbound vs outbound for the DEP-3 split.
 *
 * Strategy:
 * 1. When trips carry `directionId` (HSL feed), bucket by that — the
 *    feed's own split is the authoritative one.
 * 2. When directionId is missing across the board, fall back to the two
 *    most common terminus headsigns; each row joins the bucket whose
 *    headsign it matches. Headsigns that don't match either fall into
 *    `other`.
 *
 * Returns `undefined` when the result doesn't merit a split:
 * - the result isn't all-RAIL (so the heading and layout shouldn't change)
 * - we have fewer than 4 trips total
 * - one of the two buckets ends up empty or near-empty
 *
 * Labels are derived through `classifyRailHeadsign` so the same heuristic
 * surfaces wherever a direction needs a Finnish-readable name.
 */
export function clusterRailDirections(
  departures: TransitDeparture[],
): TransitDeparturesResult["byDirection"] | undefined {
  if (departures.length < RAIL_DIRECTION_MIN_TOTAL) return undefined;
  if (!departures.every((d) => d.vehicleMode === "RAIL")) return undefined;

  // ---- Strategy 1: directionId is populated on every trip ------------
  // Only engage when *every* row carries directionId. Mixed feeds (HSL +
  // Digitraffic at Pasila) leave many rows with null directionId, and
  // the headsign-bucket strategy below covers them more uniformly.
  const allHaveDirectionId = departures.every((d) => d.directionId);
  if (allHaveDirectionId) {
    const directionIds = new Set(departures.map((d) => d.directionId!));
    if (directionIds.size === 2) {
      const [idA, idB] = Array.from(directionIds);
      const aDeps = departures.filter((d) => d.directionId === idA);
      const bDeps = departures.filter((d) => d.directionId === idB);
      if (
        aDeps.length < RAIL_DIRECTION_MIN_PER_BUCKET ||
        bDeps.length < RAIL_DIRECTION_MIN_PER_BUCKET
      ) {
        return undefined;
      }
      return {
        a: { label: pickDirectionLabel(aDeps), departures: aDeps },
        b: { label: pickDirectionLabel(bDeps), departures: bDeps },
        other: [],
      };
    }
  }

  // ---- Strategy 2: cluster by semantic headsign bucket ---------------
  // Group every trip into a coarse SOUTH/NORTH/EAST/RING/OTHER bucket
  // via the rail-direction heuristic, pick the two most populated as A
  // and B, and let the rest fall into "other". This handles busy hubs
  // (Pasila) cleanly even with feeds that don't expose directionId.
  const byBucket = new Map<RailDirectionLabel, TransitDeparture[]>();
  for (const d of departures) {
    const bucket = classifyRailHeadsign(d.headsign).bucket;
    const list = byBucket.get(bucket) ?? [];
    list.push(d);
    byBucket.set(bucket, list);
  }
  const sorted = Array.from(byBucket.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );
  if (sorted.length < 2) return undefined;
  const [bucketA, bucketB] = sorted;
  if (
    bucketA![1].length < RAIL_DIRECTION_MIN_PER_BUCKET ||
    bucketB![1].length < RAIL_DIRECTION_MIN_PER_BUCKET
  ) {
    return undefined;
  }
  const aDeps = bucketA![1];
  const bDeps = bucketB![1];
  const others = sorted.slice(2).flatMap(([, list]) => list);
  return {
    a: { label: pickDirectionLabel(aDeps), departures: aDeps },
    b: { label: pickDirectionLabel(bDeps), departures: bDeps },
    other: others,
  };
}

/**
 * Pick the cluster's visible direction label from its dominant headsign.
 * Falls back to "Suunta A/B" when the bucket has no clear majority — never
 * leaves the FE with an empty label.
 */
function pickDirectionLabel(deps: TransitDeparture[]): string {
  if (deps.length === 0) return "";
  const counts = new Map<string, number>();
  for (const d of deps) {
    counts.set(d.headsign, (counts.get(d.headsign) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "";
  return classifyRailHeadsign(top[0]).label;
}

function applyFilters(
  data: TransitDeparture[],
  options: DeparturesOptions,
): TransitDeparture[] {
  let out = data;

  // Mode filters out rows where the event isn't possible at this stop.
  // The FE chooses which time column (arrival or departure) to render
  // — this filter only removes rows that don't make sense for the mode.
  const mode = options.mode ?? "departures";
  if (mode === "departures") {
    out = out.filter((d) => d.canBoard !== false);
  } else if (mode === "arrivals") {
    out = out.filter((d) => d.canAlight !== false);
  }
  // mode === "both" → keep rows where either is possible (effectively all)

  if (options.lineFilter && options.lineFilter.length > 0) {
    const wanted = new Set(options.lineFilter.map((l) => l.toLowerCase()));
    out = out.filter((d) => wanted.has(d.routeShortName.toLowerCase()));
  }
  if (options.directionFilter) {
    const needle = options.directionFilter.toLowerCase();
    out = out.filter((d) => d.headsign.toLowerCase().includes(needle));
  }
  if (options.lowFloorOnly) {
    out = out.filter((d) => d.wheelchairAccessible === "POSSIBLE");
  }
  return out;
}

function serviceDayForResponse(at: number | undefined): ServiceDay {
  return serviceDayFromUnix(at ?? Math.floor(Date.now() / 1000));
}

/**
 * Pass-through operation args — we always fetch the upstream superset
 * (both arrivals and departures, no per-trip filters) so the cache stores
 * the source of truth. View-state filters are applied client-side on the
 * cached payload via `applyFilters`.
 */
function buildOperationArgs(displayCount: number, at: number | undefined) {
  return {
    numberOfDepartures: Math.ceil(displayCount * FETCH_BUFFER),
    startTime: at,
    omitNonPickups: false,
  };
}

/**
 * View-state-free cache key segments. The cache slot holds the unfiltered
 * superset; FE filter combinations are resolved after the cache hit so
 * one Redis slot serves every toggle state.
 */
function dataKeySegments(
  stopId: string,
  count: number,
  isStation: boolean,
  at: number | undefined,
): (string | number | boolean)[] {
  const segments: (string | number | boolean)[] = [stopId, count, isStation];
  if (at !== undefined) segments.push(`at=${at}`);
  return segments;
}

/**
 * Wraps a cached or freshly-fetched result with the active filter chain
 * applied to its `departures` array. Other fields (stopName, subStops,
 * serviceDay, etc.) pass through unchanged. The DEP-3 `byDirection`
 * view is derived from the filtered list so toggling line / platform
 * filters keeps the side-by-side layout in sync with the visible rows.
 */
function withFilteredDepartures(
  result: TransitDeparturesResult,
  options: DeparturesOptions,
): TransitDeparturesResult {
  const departures = applyFilters(result.departures, options);
  const byDirection = clusterRailDirections(departures);
  return {
    ...result,
    departures,
    byDirection,
  };
}

export async function getStopDepartures(
  stopId: string,
  count = 20,
  isStation = false,
  persona: Persona = DEFAULT_PERSONA,
  options: DeparturesOptions = {},
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const key = cacheKey(
    "transit",
    "departures",
    2,
    ...dataKeySegments(stopId, count, isStation, options.at),
  );
  const cached = await tryCache(() => cacheGet<TransitDeparturesResult>(key));
  if (cached) {
    return { data: withFilteredDepartures(cached, options), cached: true };
  }

  const adapter = adapterRouter.forStopId(stopId);
  const ctx = makeContext(persona);
  const opArgs = buildOperationArgs(count, options.at);

  let stopName: string | null = null;
  let stoptimes: RawStoptime[] = [];

  if (isStation) {
    const raw = await adapter.stationDepartures(
      { stationId: stopId, ...opArgs },
      ctx,
    );
    if (raw.station) {
      stopName = raw.station.name;
      stoptimes = raw.station.stoptimesWithoutPatterns;
    }
  } else {
    const raw = await adapter.stopDepartures({ stopId, ...opArgs }, ctx);
    if (raw.stop) {
      stopName = raw.stop.name;
      stoptimes = raw.stop.stoptimesWithoutPatterns;
    }
  }

  if (!stopName) {
    const data: TransitDeparturesResult = {
      stopName: null,
      departures: [],
      message: "Stop not found or outside transit coverage area",
      serviceDay: serviceDayForResponse(options.at),
    };
    return { data, cached: false };
  }

  // Cache the superset; filter the response.
  const mapped = mapStoptimes(stoptimes);
  const anchorUnix = options.at ?? Math.floor(Date.now() / 1000);
  const frequency = classifyFrequency(mapped, anchorUnix);
  let serviceNote: string | undefined;
  if (frequency?.regime === "sparse") {
    const nextTrip = mapped.find(
      (d) => d.serviceDay + d.realtimeDeparture >= anchorUnix,
    );
    if (nextTrip?.tripId) {
      serviceNote = await getServiceNoteForTrip(nextTrip.tripId, persona);
    }
  }
  const supersetResult: TransitDeparturesResult = {
    stopName,
    departures: mapped,
    serviceDay: serviceDayForResponse(options.at),
    frequency,
    serviceNote,
  };
  await tryCache(() => cacheSet(key, supersetResult, DEPARTURES_V2_TTL));

  return {
    data: withFilteredDepartures(supersetResult, options),
    cached: false,
  };
}

export async function getMultiStopDepartures(
  stopIds: string[],
  subStops: TransitSubStop[],
  countPerStop = 10,
  totalCount = 40,
  stationId?: string,
  persona: Persona = DEFAULT_PERSONA,
  options: DeparturesOptions = {},
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const sortedIds = [...stopIds].sort();
  const key = cacheKey(
    "transit",
    "departures-multi",
    2,
    sortedIds.join(","),
    countPerStop,
    totalCount,
    Boolean(stationId),
    ...(options.at !== undefined ? [`at=${options.at}`] : []),
  );
  const cached = await tryCache(() => cacheGet<TransitDeparturesResult>(key));
  if (cached) {
    return { data: withFilteredDepartures(cached, options), cached: true };
  }

  const subStopMap = new Map<string, TransitSubStop>();
  for (const ss of subStops) {
    subStopMap.set(ss.gtfsId, ss);
  }

  let allDepartures: TransitDeparture[] = [];
  let stopName: string | null = null;

  const ctx = makeContext(persona);
  const opArgs = buildOperationArgs(countPerStop, options.at);

  for (let i = 0; i < sortedIds.length; i += MAX_PARALLEL_STOP_QUERIES) {
    const batch = sortedIds.slice(i, i + MAX_PARALLEL_STOP_QUERIES);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const adapter = adapterRouter.forStopId(id);
          const raw = await adapter.stopDepartures(
            { stopId: id, ...opArgs },
            ctx,
          );
          return { id, data: raw.stop };
        } catch {
          return { id, data: null };
        }
      }),
    );

    for (const result of results) {
      if (!result.data) continue;
      if (!stopName) stopName = result.data.name;
      const meta = subStopMap.get(result.id);
      const deps = mapStoptimes(result.data.stoptimesWithoutPatterns);
      for (const dep of deps) {
        dep.stopId = dep.stopId ?? result.id;
        dep.platformCode =
          dep.platformCode ?? meta?.platformCode ?? meta?.code ?? null;
      }
      allDepartures.push(...deps);
    }
  }

  // Train-platform fallback: when the per-stop queries returned nothing,
  // the station-level query sometimes does — e.g. commuter-rail platforms
  // that aren't first-class stops in the feed.
  if (allDepartures.length === 0 && stationId) {
    try {
      const adapter = adapterRouter.forStopId(stationId);
      const raw = await adapter.stationDepartures(
        { stationId, ...buildOperationArgs(totalCount, options.at) },
        ctx,
      );
      if (raw.station) {
        stopName = raw.station.name;
        const deps = mapStoptimes(raw.station.stoptimesWithoutPatterns);
        const subStopIdSet = new Set(sortedIds);
        for (const dep of deps) {
          if (dep.stopId && subStopIdSet.has(dep.stopId)) {
            allDepartures.push(dep);
          }
        }
        if (allDepartures.length === 0) {
          allDepartures = deps;
        }
      }
    } catch {
      // Station query also failed — fall through to "not found"
    }
  }

  if (!stopName) {
    const data: TransitDeparturesResult = {
      stopName: null,
      departures: [],
      subStops,
      message: "Stop not found or outside transit coverage area",
      serviceDay: serviceDayForResponse(options.at),
    };
    return { data, cached: false };
  }

  allDepartures.sort(
    (a, b) =>
      a.serviceDay + a.realtimeDeparture - (b.serviceDay + b.realtimeDeparture),
  );
  allDepartures = allDepartures.slice(0, Math.ceil(totalCount * FETCH_BUFFER));

  const anchorUnix = options.at ?? Math.floor(Date.now() / 1000);
  const frequency = classifyFrequency(allDepartures, anchorUnix);
  let serviceNote: string | undefined;
  if (frequency?.regime === "sparse") {
    const nextTrip = allDepartures.find(
      (d) => d.serviceDay + d.realtimeDeparture >= anchorUnix,
    );
    if (nextTrip?.tripId) {
      serviceNote = await getServiceNoteForTrip(nextTrip.tripId, persona);
    }
  }
  const supersetResult: TransitDeparturesResult = {
    stopName,
    departures: allDepartures,
    subStops,
    serviceDay: serviceDayForResponse(options.at),
    frequency,
    serviceNote,
  };
  await tryCache(() => cacheSet(key, supersetResult, DEPARTURES_V2_TTL));

  return {
    data: withFilteredDepartures(supersetResult, options),
    cached: false,
  };
}

export interface FirstLastResult {
  first: TransitDeparture | null;
  last: TransitDeparture | null;
  /** YYYYMMDD service date that backs the response. */
  serviceDate: string;
}

/**
 * First and last departures of a given service date at a stop.
 *
 * Sweeps every pattern serving the stop on `date` via
 * `stoptimesForServiceDate`, flattens into one list, and returns the
 * earliest + latest by absolute unix time. Cached at
 * `transit:first-last:v1:<stopId>:<date>` for the service-range TTL —
 * tomorrow's first/last barely changes through the day.
 */
export async function getFirstLastOfDay(
  stopId: string,
  date: string,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: FirstLastResult; cached: boolean }> {
  const key = cacheKey("transit", "first-last", 1, stopId, date);
  const cached = await tryCache(() => cacheGet<FirstLastResult>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forStopId(stopId);
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx = makeContext(persona);

  const patterns = await stoptimesForDateOperation(
    client,
    { stopId, date },
    ctx,
  );

  const all: TransitDeparture[] = [];
  for (const p of patterns) {
    for (const st of p.stoptimes) {
      all.push({
        routeShortName: p.pattern.route.shortName,
        routeLongName: p.pattern.route.longName,
        headsign: st.headsign,
        // tripsForDate doesn't expose arrival times — fall back to
        // departure times. First / last is a per-stop range, not a
        // per-row arrival vs departure question, so this is fine.
        scheduledArrival: st.scheduledDeparture,
        realtimeArrival: st.realtimeDeparture,
        arrivalDelay: st.departureDelay,
        scheduledDeparture: st.scheduledDeparture,
        realtimeDeparture: st.realtimeDeparture,
        departureDelay: st.departureDelay,
        realtime: st.realtime,
        serviceDay: st.serviceDay,
        vehicleMode: p.pattern.route.mode,
        tripId: st.trip.gtfsId,
      });
    }
  }

  if (all.length === 0) {
    const data: FirstLastResult = {
      first: null,
      last: null,
      serviceDate: date,
    };
    await tryCache(() => cacheSet(key, data, SERVICE_RANGE_TTL));
    return { data, cached: false };
  }

  all.sort(
    (a, b) =>
      a.serviceDay +
      a.scheduledDeparture -
      (b.serviceDay + b.scheduledDeparture),
  );

  const data: FirstLastResult = {
    first: all[0] ?? null,
    last: all[all.length - 1] ?? null,
    serviceDate: date,
  };
  await tryCache(() => cacheSet(key, data, SERVICE_RANGE_TTL));
  return { data, cached: false };
}
