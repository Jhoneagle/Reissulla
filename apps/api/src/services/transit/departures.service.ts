import {
  DEFAULT_PERSONA,
  type Persona,
  type TransitDeparture,
  type TransitDeparturesResult,
  type TransitSubStop,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { DEPARTURES_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { adapterForGtfsId } from "../../adapters/digitransit-routing/dispatch.js";
import type { AdapterContext } from "../../adapters/types.js";
import type { RawStoptime } from "../../adapters/digitransit-routing/types.js";

const MAX_PARALLEL_STOP_QUERIES = 10;

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
  }));
}

export async function getStopDepartures(
  stopId: string,
  count = 20,
  isStation = false,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const key = cacheKey("transit", "departures", 1, stopId, count, isStation);
  const cached = await tryCache(() => cacheGet<TransitDeparturesResult>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterForGtfsId(stopId);
  const ctx = makeContext(persona);

  let stopName: string | null = null;
  let stoptimes: RawStoptime[] = [];

  if (isStation) {
    const raw = await adapter.stationDepartures(stopId, count, ctx);
    if (raw.station) {
      stopName = raw.station.name;
      stoptimes = raw.station.stoptimesWithoutPatterns;
    }
  } else {
    const raw = await adapter.stopDepartures(stopId, count, ctx);
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
    };
    return { data, cached: false };
  }

  const departures = mapStoptimes(stoptimes);

  const data: TransitDeparturesResult = {
    stopName,
    departures,
  };

  await tryCache(() => cacheSet(key, data, DEPARTURES_TTL));
  return { data, cached: false };
}

export async function getMultiStopDepartures(
  stopIds: string[],
  subStops: TransitSubStop[],
  countPerStop = 10,
  totalCount = 40,
  stationId?: string,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: TransitDeparturesResult; cached: boolean }> {
  const sortedIds = [...stopIds].sort();
  const key = cacheKey(
    "transit",
    "departures-multi",
    1,
    sortedIds.join(","),
    countPerStop,
    totalCount,
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

  for (let i = 0; i < sortedIds.length; i += MAX_PARALLEL_STOP_QUERIES) {
    const batch = sortedIds.slice(i, i + MAX_PARALLEL_STOP_QUERIES);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const adapter = adapterForGtfsId(id);
          const raw = await adapter.stopDepartures(id, countPerStop, ctx);
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
      const adapter = adapterForGtfsId(stationId);
      const raw = await adapter.stationDepartures(stationId, totalCount, ctx);
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
    };
    return { data, cached: false };
  }

  allDepartures.sort(
    (a, b) =>
      a.serviceDay + a.realtimeDeparture - (b.serviceDay + b.realtimeDeparture),
  );
  allDepartures = allDepartures.slice(0, totalCount);

  const data: TransitDeparturesResult = {
    stopName,
    departures: allDepartures,
    subStops,
  };

  await tryCache(() => cacheSet(key, data, DEPARTURES_TTL));
  return { data, cached: false };
}
