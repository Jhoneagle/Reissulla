import type { Persona } from "./persona.js";

/**
 * Trip-planner primitives consumed by the planner service and its surfaces.
 *
 * `TripQuery` is the orchestrator-side shape — it carries the merged
 * persona that the orchestrator builds from the `x-reissulla-persona`
 * header. The wire body for the plan endpoint is the persona-stripped
 * projection `Omit<TripQuery, "persona">` so persona is never duplicated
 * across header and body.
 *
 * `PlanRouteOptions` is the service-level argument bundle — `TripQuery`
 * plus the call-level option `numItineraries`. Adapter calls receive the
 * resolved primitives, not this struct.
 */

export type TransitMode =
  | "BUS"
  | "TRAM"
  | "RAIL"
  | "SUBWAY"
  | "FERRY"
  | "WALK"
  | "BICYCLE";

/** Coarse planner intent; maps onto OTP2 routing weight presets. */
export type TripPreference = "fastest" | "fewest-transfers" | "least-walking";

export type WalkingSpeed = "slow" | "normal" | "fast";

export interface PlanPreferences {
  walkingSpeed: WalkingSpeed;
  /** Max walk distance per leg (metres). */
  maxWalkDistanceMeters: number;
  /** Cap at one transfer per itinerary (UI-driven TRIP-12). */
  avoidTransfers: boolean;
  /** Avoid routes that require stairs / escalators (TRIP-13). */
  avoidStairs: boolean;
}

export const DEFAULT_PLAN_PREFERENCES: PlanPreferences = {
  walkingSpeed: "normal",
  maxWalkDistanceMeters: 1000,
  avoidTransfers: false,
  avoidStairs: false,
};

export interface TripQuery {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  /** Unix seconds. When omitted, the planner uses "now". */
  dateTime?: number;
  /** When true, `dateTime` is the arrival time; otherwise the departure time. */
  arriveBy?: boolean;
  preference: TripPreference;
  modes: TransitMode[];
  planPreferences: PlanPreferences;
  /** Merged from the persona header at the orchestrator — never on the wire. */
  persona: Persona;
}

export interface PlanRouteOptions {
  query: TripQuery;
  numItineraries: number;
  /**
   * When `true`, the planner composes itinerary weather (origin + destination
   * forecast plus per-leg outdoor-wait notes) and attaches it to every
   * returned `TransitItinerary.weather`. Defaults to `false` so legacy and
   * share-link callers keep the lean payload.
   */
  includeWeather?: boolean;
  /**
   * Route gtfsIds (FeedId:RouteId) the planner must avoid. Set by the
   * disruption-driven re-plan path so the alternative skips the disrupted
   * route; empty / undefined on a normal plan.
   */
  excludeRoutes?: string[];
}
