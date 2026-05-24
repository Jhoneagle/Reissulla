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
import { DEPARTURES_V2_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import type { AdapterContext } from "../../adapters/types.js";
import type { RawStoptime } from "../../adapters/digitransit-routing/types.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { stoptimesForDateOperation } from "../../adapters/digitransit-routing/operations/stoptimesForDate.js";
import { SERVICE_RANGE_TTL } from "../../cache/ttl.js";
import { adapterRouter } from "./adapter-router.js";

const MAX_PARALLEL_STOP_QUERIES = 10;

export type ArrivalDepartureMode = "departures" | "arrivals" | "both";

/**
 * OTP2 GTFS only exposes `omitNonPickups` (default false) to narrow
 * stoptimes to "departures only" — there is no distinct ARRIVALS toggle on
 * `stoptimesWithoutPatterns`. The FE three-way choice maps onto this
 * single switch: departures → true (exclude terminus / drop-off only);
 * arrivals / both → false (include drop-offs).
 */
function omitNonPickupsFor(mode: ArrivalDepartureMode | undefined): boolean {
  return mode === undefined || mode === "departures";
}

export interface DeparturesOptions {
  /** Unix seconds. When set, future-time picker — departures after `at`. */
  at?: number;
  /**
   * When true, `at` is the desired arrival time, not departure time.
   * OTP2 lacks a native arrive-by flag for stoptimes; we approximate by
   * widening the lookahead so the FE can show arrivals near the time
   * the user wants to be there.
   */
  arriveBy?: boolean;
  /** ARRIVALS / DEPARTURES / BOTH — backs the DEP-2 arrivals toggle. */
  mode?: ArrivalDepartureMode;
  /** Comma-separated routeShortName whitelist (DEP-5). */
  lineFilter?: string[];
  /**
   * Headsign substring (case-insensitive) — DEP-6 direction filter.
   * Matches when the headsign contains the substring.
   */
  directionFilter?: string;
  /** A11Y-19 — drop departures whose trip is not low-floor accessible. */
  lowFloorOnly?: boolean;
}

function makeContext(persona: Persona): AdapterContext {
  return { signal: new AbortController().signal, persona };
}

function mapStoptimes(stoptimes: RawStoptime[]): TransitDeparture[] {
  return stoptimes.map((st) => ({
    routeShortName: st.trip.route.shortName,
    routeLongName: st.trip.route.longName,
    headsign: st.headsign,
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
  }));
}

function applyFilters(
  data: TransitDeparture[],
  options: DeparturesOptions,
): TransitDeparture[] {
  let out = data;
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

function buildOperationArgs(count: number, options: DeparturesOptions) {
  return {
    numberOfDepartures: count,
    startTime: options.at,
    omitNonPickups: omitNonPickupsFor(options.mode),
    timeRange: options.arriveBy ? 12 * 60 * 60 : undefined,
  };
}

function cacheKeySegments(
  stopId: string,
  count: number,
  isStation: boolean,
  options: DeparturesOptions,
): (string | number | boolean)[] {
  // v2 segment widens for at / arriveBy / filters / mode / lowFloor.
  // Old v1 keys time out naturally per the cache-key version-segment
  // policy — no Redis flush.
  const segments: (string | number | boolean)[] = [stopId, count, isStation];
  if (options.at !== undefined) segments.push(`at=${options.at}`);
  if (options.arriveBy) segments.push("arriveBy");
  if (options.mode && options.mode !== "departures") {
    segments.push(`m=${options.mode}`);
  }
  if (options.lineFilter && options.lineFilter.length > 0) {
    segments.push(`lines=${[...options.lineFilter].sort().join(",")}`);
  }
  if (options.directionFilter) {
    segments.push(`dir=${options.directionFilter.toLowerCase()}`);
  }
  if (options.lowFloorOnly) segments.push("lowFloor");
  return segments;
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
    ...cacheKeySegments(stopId, count, isStation, options),
  );
  const cached = await tryCache(() => cacheGet<TransitDeparturesResult>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forStopId(stopId);
  const ctx = makeContext(persona);
  const opArgs = buildOperationArgs(count, options);

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

  const departures = applyFilters(mapStoptimes(stoptimes), options);

  const data: TransitDeparturesResult = {
    stopName,
    departures,
    serviceDay: serviceDayForResponse(options.at),
  };

  await tryCache(() => cacheSet(key, data, DEPARTURES_V2_TTL));
  return { data, cached: false };
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
    ...cacheKeySegments("", 0, Boolean(stationId), options).slice(3),
  );
  const cached = await tryCache(() => cacheGet<TransitDeparturesResult>(key));
  if (cached) return { data: cached, cached: true };

  const subStopMap = new Map<string, TransitSubStop>();
  for (const ss of subStops) {
    subStopMap.set(ss.gtfsId, ss);
  }

  let allDepartures: TransitDeparture[] = [];
  let stopName: string | null = null;

  const ctx = makeContext(persona);
  const opArgs = buildOperationArgs(countPerStop, options);

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

  // Some stops (e.g. train platforms) only return data via the station-level query.
  if (allDepartures.length === 0 && stationId) {
    try {
      const adapter = adapterRouter.forStopId(stationId);
      const raw = await adapter.stationDepartures(
        { stationId, ...buildOperationArgs(totalCount, options) },
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

  allDepartures = applyFilters(allDepartures, options);

  allDepartures.sort(
    (a, b) =>
      a.serviceDay + a.realtimeDeparture - (b.serviceDay + b.realtimeDeparture),
  );
  allDepartures = allDepartures.slice(0, totalCount);

  const data: TransitDeparturesResult = {
    stopName,
    departures: allDepartures,
    subStops,
    serviceDay: serviceDayForResponse(options.at),
  };

  await tryCache(() => cacheSet(key, data, DEPARTURES_V2_TTL));
  return { data, cached: false };
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
 * `stoptimesForServiceDate`, flattens into a single list, and pulls the
 * earliest + latest departure by absolute unix time. Cached at
 * `transit:first-last:v1:<stopId>:<date>` for the service-range TTL —
 * tomorrow's first/last shouldn't change second-by-second.
 *
 * Returns nulls when the stop is unknown or the feed has no schedule
 * for the requested day (rural feeds with short serviceTimeRange).
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
