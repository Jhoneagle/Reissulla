import {
  DEFAULT_PLAN_PREFERENCES,
  type Alert,
  type AlertEffect,
  type Persona,
  type ReplanInput,
  type ReplanResult,
  type TransitItinerary,
  type TripQuery,
} from "@reissulla/shared";
import { planRouteFull } from "./trip.service.js";

/**
 * Disruption-driven re-plan (LIVE-6, TRIP-18). Mirrors
 * `docs/technical-plan.md` §6.4.
 *
 * The check is intentionally narrow: only an alert that BOTH names a route the
 * base itinerary actually rides AND carries a service-breaking effect
 * (`NO_SERVICE` / `DETOUR`) warrants re-planning around the route. A
 * `SIGNIFICANT_DELAYS` alert is not re-planned — the realtime delta already on
 * the leg is the right surface for a running-late vehicle, so we only flag the
 * itinerary so the FE can offer the other already-returned options (TRIP-18).
 */

const DISRUPTIVE_EFFECTS: readonly AlertEffect[] = ["NO_SERVICE", "DETOUR"];

/** Route gtfsIds the base itinerary boards (transit legs only). */
function boardedRouteIds(itinerary: TransitItinerary): Set<string> {
  const ids = new Set<string>();
  for (const leg of itinerary.legs) {
    const id = leg.route?.gtfsId;
    if (id) ids.add(id);
  }
  return ids;
}

/** Active route-scoped alerts whose route the base itinerary actually rides. */
function alertsOnItinerary(alerts: Alert[], routeIds: Set<string>): Alert[] {
  return alerts.filter(
    (a) => a.scope.kind === "route" && routeIds.has(a.scope.gtfsId),
  );
}

function distinctRouteIds(alerts: Alert[]): string[] {
  const ids = new Set<string>();
  for (const a of alerts) {
    if (a.scope.kind === "route") ids.add(a.scope.gtfsId);
  }
  return [...ids];
}

function distinctEffects(alerts: Alert[]): AlertEffect[] {
  const effects = new Set<AlertEffect>();
  for (const a of alerts) {
    if (a.effect !== null) effects.add(a.effect);
  }
  return [...effects];
}

/**
 * Rebuild a `TripQuery` from the base itinerary's endpoints + the user's
 * persona. The re-plan honours the same origin / destination / departure
 * anchor and accessibility profile; mode + preference fall back to the planner
 * defaults (the original request's mode set is not carried on the itinerary,
 * and a re-plan around a disruption is best served by the full mode palette).
 */
function reconstructQuery(
  itinerary: TransitItinerary,
  persona: Persona,
): TripQuery | null {
  const first = itinerary.legs.at(0);
  const last = itinerary.legs.at(-1);
  if (!first || !last) return null;
  return {
    from: { lat: first.from.lat, lon: first.from.lon },
    to: { lat: last.to.lat, lon: last.to.lon },
    dateTime: Math.floor(itinerary.startTime / 1000),
    arriveBy: false,
    preference: "fastest",
    modes: ["BUS", "RAIL", "TRAM", "SUBWAY", "FERRY"],
    planPreferences: DEFAULT_PLAN_PREFERENCES,
    persona,
  };
}

export async function suggestReplan({
  baseItinerary,
  activeAlerts,
  persona,
}: ReplanInput): Promise<ReplanResult> {
  const routeIds = boardedRouteIds(baseItinerary);
  if (routeIds.size === 0) return { triggered: false };

  const relevant = alertsOnItinerary(activeAlerts, routeIds);
  if (relevant.length === 0) return { triggered: false };

  const disruptive = relevant.filter(
    (a) => a.effect !== null && DISRUPTIVE_EFFECTS.includes(a.effect),
  );

  if (disruptive.length > 0) {
    const excludeRoutes = distinctRouteIds(disruptive);
    const query = reconstructQuery(baseItinerary, persona);
    if (query === null) return { triggered: false };
    // The alternative is a secondary surface — keep it lean (no weather
    // composition) so a disruption doesn't fan a forecast call out on every
    // plan; the FE weather strip simply renders nothing when it's absent.
    const { data: alternative } = await planRouteFull({
      query,
      numItineraries: 3,
      includeWeather: false,
      excludeRoutes,
    });
    return {
      triggered: true,
      reason: {
        alertIds: disruptive.map((a) => a.id),
        effect: distinctEffects(disruptive),
      },
      alternative,
    };
  }

  // No route ban warranted, but a SIGNIFICANT_DELAYS alert touches the route:
  // flag it so the FE can surface the other itineraries already returned.
  const delays = relevant.filter((a) => a.effect === "SIGNIFICANT_DELAYS");
  if (delays.length > 0) {
    return {
      triggered: false,
      reason: {
        alertIds: delays.map((a) => a.id),
        effect: ["SIGNIFICANT_DELAYS"],
      },
    };
  }

  return { triggered: false };
}
