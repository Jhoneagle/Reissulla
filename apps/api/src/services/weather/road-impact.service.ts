import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { WEATHER_ROADS_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { fintrafficAdapter } from "../../adapters/fintraffic/index.js";
import type {
  RoadCondition,
  RoadSurfaceState,
} from "../../adapters/fintraffic/types.js";
import type { AdapterContext } from "../../adapters/types.js";

/**
 * Single source of truth for translating Fintraffic surface state into a
 * walking-time multiplier. Owned here so both the planner (Chunk 3) and
 * the itinerary weather strip (Chunk 6) agree on the same penalty curve,
 * and so the FE can label the delta with a stable `reason` tag.
 *
 * Multipliers are conservative: this is a hint for users on foot, not a
 * promise. Black-ice nudges the slowest reasonable walker; slush is the
 * second hop. Frosty / snowy hover near +5% because well-maintained urban
 * paths usually clear within hours; the indoor user notices the chip but
 * doesn't lose minutes off a 4-minute leg.
 *
 * The chip / banner labels speak in everyday Finnish + English; the
 * `reason` token below is the structural key the UI looks up.
 */
export type RoadImpactReason =
  | "ice"
  | "partly-ice"
  | "slush"
  | "snow"
  | "frost"
  | "wet";

export interface RoadImpact {
  /** Walking-time multiplier, 1.0 = no effect. */
  multiplier: number;
  /** Stable identifier the FE turns into a translated label. */
  reason: RoadImpactReason;
}

const IMPACTS: Record<RoadSurfaceState, RoadImpact | null> = {
  dry: null,
  wet: { multiplier: 1.03, reason: "wet" },
  "moist-salty": { multiplier: 1.05, reason: "slush" },
  frosty: { multiplier: 1.08, reason: "frost" },
  snowy: { multiplier: 1.1, reason: "snow" },
  "partly-icy": { multiplier: 1.12, reason: "partly-ice" },
  icy: { multiplier: 1.15, reason: "ice" },
};

/**
 * Look up the multiplier for a given surface state. Returns null when
 * the surface is dry (or unknown) so callers can short-circuit without
 * allocating a `multiplier: 1.0` envelope.
 */
export function impactFromSurfaceState(
  surfaceState: RoadSurfaceState | null,
): RoadImpact | null {
  if (surfaceState === null) return null;
  return IMPACTS[surfaceState];
}

/**
 * Apply the road impact to a leg duration (seconds) and return both the
 * original baseline and the adjusted duration. The planner stores both
 * so the UI can render "+N min ice" without re-deriving from a delta.
 */
export interface AdjustedDuration {
  baseDuration: number;
  duration: number;
  impact: RoadImpact;
}

export function adjustWalkDuration(
  baseDuration: number,
  condition: RoadCondition | null,
): AdjustedDuration | null {
  if (condition === null) return null;
  const impact = impactFromSurfaceState(condition.surfaceState);
  if (impact === null) return null;
  return {
    baseDuration,
    duration: Math.round(baseDuration * impact.multiplier),
    impact,
  };
}

/**
 * Cache-wrapped Fintraffic road-condition lookup. Shares the same key
 * shape and TTL as `composition.service.ts` so the planner and the
 * weather snapshot reuse each other's reads. A swallowed upstream error
 * resolves to `null` (no penalty applied), keeping the planner resilient
 * to a Fintraffic outage.
 */
export async function getCachedRoadCondition(
  lat: number,
  lon: number,
  ctx: AdapterContext,
): Promise<RoadCondition | null> {
  const key = cacheKey("weather", "roads", 1, lat.toFixed(2), lon.toFixed(2));
  const hit = await tryCache(() => cacheGet<RoadCondition | null>(key));
  if (hit !== null) return hit;
  try {
    const data = await fintrafficAdapter.getRoadConditions(lat, lon, ctx);
    await tryCache(() => cacheSet(key, data, WEATHER_ROADS_TTL));
    return data;
  } catch {
    return null;
  }
}
