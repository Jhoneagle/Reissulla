import type { TransitItinerary } from "./transit.js";

/**
 * One recorded trip plan in the user's opt-in trip log (HIST-1). The chosen
 * itinerary is snapshotted at plan time so History renders exactly what was
 * planned — no re-plan, no drift if the schedule changes afterwards.
 */
export interface TripLogEntry {
  id: string;
  from: { lat: number; lon: number; name: string | null };
  to: { lat: number; lon: number; name: string | null };
  /** Snapshot of the itinerary the user planned. */
  itinerary: TransitItinerary;
  /** ISO-8601 timestamp the trip was planned. */
  plannedAt: string;
}

/**
 * A frequently-used stop or line the user hasn't pinned yet (HIST-2). Derived
 * statelessly from the trip log on every read — no "dismiss forever" store;
 * the dashboard suppresses a dismissed suggestion per-session via
 * sessionStorage, and a fresh session re-surfaces it.
 */
export interface PinSuggestion {
  gtfsId: string;
  /** Stop name, or line short name for a line suggestion. */
  name: string;
  /** BUS / TRAM / RAIL / SUBWAY / FERRY. Null when the source leg lacked one. */
  vehicleMode: string | null;
  /** Times it appeared in the trip log within `windowDays`. */
  uses: number;
  /** Window length (days) the count was computed over. */
  windowDays: number;
}

export interface PinSuggestions {
  stops: PinSuggestion[];
  lines: PinSuggestion[];
}
