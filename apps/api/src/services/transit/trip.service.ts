import { createHash } from "node:crypto";
import {
  DEFAULT_PERSONA,
  DEFAULT_PLAN_PREFERENCES,
  personaToPlanArgs,
  serializePersona,
  type PlanPreferences,
  type PlanRouteOptions,
  type Persona,
  type TransitItinerary,
  type TransitItineraryLeg,
  type TransitPlanResult,
  type TripQuery,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { PLAN_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import type { AdapterContext } from "../../adapters/types.js";
import type { PlanConnectionMode } from "../../adapters/digitransit-routing/types.js";
import { adapterRouter } from "./adapter-router.js";
import {
  adjustWalkDuration,
  getCachedRoadCondition,
} from "../weather/road-impact.service.js";
import type { RoadCondition } from "../../adapters/fintraffic/types.js";
import { attachItineraryWeather } from "./trip-weather.service.js";

function makeContext(persona: Persona): AdapterContext {
  return {
    signal: new AbortController().signal,
    locale: persona.language,
    persona,
  };
}

const WALK_SPEEDS: Record<PlanPreferences["walkingSpeed"], number> = {
  slow: 1.0,
  normal: 1.34,
  fast: 1.6,
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Stable hash of the options that don't already appear in the cache key as
 * coordinates or persona. Deep-sorted keys + SHA-1 prefix → identical options
 * produce identical hash, different options produce different slots.
 */
export function optionsHash(
  query: Omit<TripQuery, "persona" | "from" | "to">,
  numItineraries: number,
): string {
  const normalised = {
    arriveBy: query.arriveBy === true,
    dateTime: typeof query.dateTime === "number" ? query.dateTime : null,
    modes: [...query.modes].sort(),
    numItineraries,
    planPreferences: {
      avoidStairs: query.planPreferences.avoidStairs === true,
      avoidTransfers: query.planPreferences.avoidTransfers === true,
      maxWalkDistanceMeters: query.planPreferences.maxWalkDistanceMeters,
      walkingSpeed: query.planPreferences.walkingSpeed,
    },
    preference: query.preference,
  };
  return createHash("sha1")
    .update(stableStringify(normalised))
    .digest("hex")
    .slice(0, 12);
}

/**
 * Compatibility wrapper for the legacy 4-coordinate call site. Wraps the
 * coordinates in a default `TripQuery` and forwards to `planRouteFull`.
 */
export async function planRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  numItineraries = 5,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: TransitPlanResult; cached: boolean }> {
  return planRouteFull({
    query: {
      from: { lat: fromLat, lon: fromLon },
      to: { lat: toLat, lon: toLon },
      preference: "fastest",
      modes: ["BUS", "RAIL", "TRAM", "SUBWAY", "FERRY"],
      planPreferences: DEFAULT_PLAN_PREFERENCES,
      persona,
    },
    numItineraries,
  });
}

export async function planRouteFull({
  query,
  numItineraries,
  includeWeather = false,
  excludeRoutes,
}: PlanRouteOptions): Promise<{ data: TransitPlanResult; cached: boolean }> {
  const persona = query.persona ?? DEFAULT_PERSONA;
  // A re-plan that bans routes must not collide with the cache slot of the
  // un-excluded plan for the same coordinates — fold the sorted ban list into
  // the key tail.
  const excludeTail =
    excludeRoutes && excludeRoutes.length > 0
      ? `x${[...excludeRoutes].sort().join(",")}`
      : "x0";
  // v4: cache key tail gains a `w0` / `w1` flag so a cached weatherless
  // plan doesn't satisfy a weather=true reader and vice versa. Old v3
  // keys time out naturally per the cache-key version-segment policy.
  const key = cacheKey(
    "transit",
    "plan",
    4,
    query.from.lat.toFixed(3),
    query.from.lon.toFixed(3),
    query.to.lat.toFixed(3),
    query.to.lon.toFixed(3),
    optionsHash(
      {
        arriveBy: query.arriveBy,
        dateTime: query.dateTime,
        modes: query.modes,
        planPreferences: query.planPreferences,
        preference: query.preference,
      },
      numItineraries,
    ),
    serializePersona(persona),
    includeWeather ? "w1" : "w0",
    excludeTail,
  );
  const cached = await tryCache(() => cacheGet<TransitPlanResult>(key));
  if (cached) return { data: cached, cached: true };

  const personaArgs = personaToPlanArgs(persona);
  const preference = query.preference;
  const adapter = adapterRouter.forCoordinate(query.from.lat, query.from.lon);
  const raw = await adapter.planConnection(
    {
      fromLat: query.from.lat,
      fromLon: query.from.lon,
      toLat: query.to.lat,
      toLon: query.to.lon,
      numItineraries,
      dateTime: query.dateTime,
      arriveBy: query.arriveBy,
      transitModes: query.modes.filter(
        (m) => m !== "WALK" && m !== "BICYCLE",
      ) as PlanConnectionMode[],
      walkSpeedMetresPerSec:
        personaArgs.walkSpeedMetresPerSec ??
        WALK_SPEEDS[query.planPreferences.walkingSpeed],
      walkReluctanceBoost:
        preference === "least-walking" ||
        personaArgs.avoidStairs === true ||
        query.planPreferences.avoidStairs === true,
      numberOfTransfers:
        query.planPreferences.avoidTransfers ||
        preference === "fewest-transfers" ||
        personaArgs.preferFewerTransfers === true
          ? 1
          : undefined,
      avoidStairs:
        query.planPreferences.avoidStairs === true ||
        personaArgs.avoidStairs === true,
      excludeRoutes,
    },
    makeContext(persona),
  );

  const edges = raw.planConnection?.edges ?? [];

  if (edges.length === 0) {
    const data: TransitPlanResult = {
      itineraries: [],
      message:
        "No transit routes found between these locations. They may be outside the transit coverage area.",
    };
    await tryCache(() => cacheSet(key, data, PLAN_TTL));
    return { data, cached: false };
  }

  const appliedPersonaFlags: TransitItinerary["appliedPersonaFlags"] = {
    wheelchair: personaArgs.wheelchair === true,
    lowFloor: persona.lowFloor === true,
    stroller: persona.stroller && !personaArgs.wheelchair,
  };

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
      route: leg.route
        ? {
            gtfsId: leg.route.gtfsId ?? undefined,
            shortName: leg.route.shortName,
            longName: leg.route.longName,
          }
        : undefined,
      operator:
        leg.route?.agency && leg.route.agency.name
          ? { gtfsId: leg.route.agency.gtfsId, name: leg.route.agency.name }
          : undefined,
      intermediateStops: leg.intermediateStops ?? undefined,
      steps:
        leg.mode === "WALK" && leg.steps && leg.steps.length > 0
          ? leg.steps
          : undefined,
    }));

    return {
      startTime: node.startTime,
      endTime: node.endTime,
      duration: Math.round((node.endTime - node.startTime) / 1000),
      walkDistance: node.walkDistance,
      transfers: node.numberOfTransfers,
      legs,
      farePlaceholders: true,
      appliedPersonaFlags,
    };
  });

  await applyWalkRoadImpact(itineraries, makeContext(persona));

  // Weather composition is the last step so a partial-failure forecast
  // doesn't block the road-impact penalty from landing on WALK legs.
  if (includeWeather) {
    await attachItineraryWeather(itineraries, makeContext(persona));
  }

  const data: TransitPlanResult = { itineraries };
  await tryCache(() => cacheSet(key, data, PLAN_TTL));
  return { data, cached: false };
}

/**
 * Mutates each WALK leg in place when Fintraffic reports a non-dry surface
 * near the leg's origin: preserves the un-penalised seconds in
 * `baseDuration`, multiplies `duration` by the road-impact factor, and
 * attaches the `roadImpact` envelope the FE turns into a chip. Itinerary-
 * level `startTime`/`endTime`/`duration` stay as OTP2 computed them — the
 * upstream timing is the authoritative arrival; the per-leg label warns
 * the user that real-world walking may take longer.
 *
 * Coalesces upstream calls by coarse-precision (2-decimal) coord key so a
 * multi-walking-leg itinerary doesn't fan out to Fintraffic more than
 * once per ~1 km region.
 */
async function applyWalkRoadImpact(
  itineraries: TransitItinerary[],
  ctx: AdapterContext,
): Promise<void> {
  const walkLegs = itineraries.flatMap((it) =>
    it.legs.filter((l) => l.mode === "WALK"),
  );
  if (walkLegs.length === 0) return;

  const conditionFor = new Map<string, Promise<RoadCondition | null>>();
  const lookup = (lat: number, lon: number): Promise<RoadCondition | null> => {
    const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
    const existing = conditionFor.get(key);
    if (existing) return existing;
    const fresh = getCachedRoadCondition(lat, lon, ctx);
    conditionFor.set(key, fresh);
    return fresh;
  };

  await Promise.all(
    walkLegs.map(async (leg) => {
      const condition = await lookup(leg.from.lat, leg.from.lon);
      const adjusted = adjustWalkDuration(leg.duration, condition);
      if (adjusted === null) return;
      leg.baseDuration = adjusted.baseDuration;
      leg.duration = adjusted.duration;
      leg.roadImpact = {
        reason: adjusted.impact.reason,
        multiplier: adjusted.impact.multiplier,
      };
    }),
  );
}
