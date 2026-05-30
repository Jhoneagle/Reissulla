import { type Persona } from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { TRIP_DETAIL_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { tripOperation } from "../../adapters/digitransit-routing/operations/trip.js";
import type { RawTrip } from "../../adapters/digitransit-routing/types.js";
import type { AdapterContext } from "../../adapters/types.js";
import { adapterRouter } from "./adapter-router.js";

/**
 * Single source of truth for the cached upstream `RawTrip`. Both the
 * sparse-frequency service-note path and the trip-detail page consume
 * from here so a click-through after a frequency-classified board fetch
 * only hits upstream once.
 *
 * Cache slot: `transit:trip:v1:<tripId>`. The previous frequency-only
 * cache (`transit:trip-active-dates:v1:<tripId>`) lives under a different
 * entity name, so the two never collide and old entries TTL out per the
 * cache-key version policy.
 *
 * Upstream nulls (stale tripId) propagate as `data: null` and are NOT
 * cached — distinguishing a cached null from a cache miss costs more
 * complexity than the rare extra upstream hit saves.
 */
export async function fetchAndCacheTrip(
  tripId: string,
  persona: Persona,
): Promise<{ data: RawTrip | null; cached: boolean }> {
  const key = cacheKey("transit", "trip", 1, tripId);
  const hit = await tryCache(() => cacheGet<RawTrip>(key));
  if (hit !== null) return { data: hit, cached: true };

  const adapter = adapterRouter.forStopId(tripId);
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx: AdapterContext = {
    signal: new AbortController().signal,
    persona,
  };

  const trip = await tripOperation(client, { tripId }, ctx);
  if (trip !== null) {
    await tryCache(() => cacheSet(key, trip, TRIP_DETAIL_TTL));
  }
  return { data: trip, cached: false };
}
