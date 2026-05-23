import type {
  TransitItinerary,
  TransitItineraryLeg,
  TransitPlanResult,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { PLAN_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { defaultAdapter } from "../../adapters/digitransit-routing/dispatch.js";
import type { AdapterContext } from "../../adapters/types.js";

function makeContext(): AdapterContext {
  return { signal: new AbortController().signal };
}

export async function planRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  numItineraries = 5,
): Promise<{ data: TransitPlanResult; cached: boolean }> {
  const key = cacheKey(
    "transit",
    "plan",
    1,
    fromLat.toFixed(3),
    fromLon.toFixed(3),
    toLat.toFixed(3),
    toLon.toFixed(3),
  );
  const cached = await tryCache(() => cacheGet<TransitPlanResult>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = defaultAdapter();
  const raw = await adapter.planConnection(
    { fromLat, fromLon, toLat, toLon, numItineraries },
    makeContext(),
  );

  const edges = raw.planConnection?.edges ?? [];

  if (edges.length === 0) {
    const data: TransitPlanResult = {
      itineraries: [],
      message:
        "No transit routes found between these locations. They may be outside the transit coverage area.",
    };
    return { data, cached: false };
  }

  const itineraries: TransitItinerary[] = edges.map((edge) => {
    const node = edge.node;
    const legs: TransitItineraryLeg[] = node.legs.map((leg) => ({
      mode: leg.mode,
      startTime: leg.startTime,
      endTime: leg.endTime,
      duration: leg.duration,
      distance: leg.distance,
      from: {
        name: leg.from.name,
        lat: leg.from.lat,
        lon: leg.from.lon,
        stop: leg.from.stop ?? undefined,
      },
      to: {
        name: leg.to.name,
        lat: leg.to.lat,
        lon: leg.to.lon,
        stop: leg.to.stop ?? undefined,
      },
      route: leg.route ?? undefined,
      intermediateStops: leg.intermediateStops ?? undefined,
    }));

    return {
      startTime: node.startTime,
      endTime: node.endTime,
      duration: Math.round((node.endTime - node.startTime) / 1000),
      walkDistance: node.walkDistance,
      transfers: node.numberOfTransfers,
      legs,
    };
  });

  const data: TransitPlanResult = { itineraries };
  await tryCache(() => cacheSet(key, data, PLAN_TTL));
  return { data, cached: false };
}
