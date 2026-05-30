// Cache TTLs in seconds, consolidated so they're discoverable in one place.
// Bump alongside the cache-key version segment when the value shape changes.

export const WEATHER_CURRENT_TTL = 900; // 15 min — Open-Meteo updates hourly
export const WEATHER_FORECAST_TTL = 1800; // 30 min

export const GEOCODE_SEARCH_TTL = 86_400; // 24 h — places don't move
export const GEOCODE_REVERSE_TTL = 86_400; // 24 h

export const STOPS_TTL = 3_600; // 1 h — stops rarely move
export const DEPARTURES_TTL = 60; // 1 min — needs to feel fresh
export const PLAN_TTL = 300; // 5 min — itineraries decay with traffic

// ---- Phase 2 entries -------------------------------------------------------
// Defined here so the consuming services don't need to touch this file.

/**
 * Trip drill-down (transit:trip:v1:<tripId>).
 *
 * The cached RawTrip carries realtimeArrival/Departure/Delay alongside the
 * static skeleton — a 5-min TTL would let the live-status sentence
 * ("Bussi pysäkillä Kamppi") lag reality by minutes. 60s matches
 * DEPARTURES_TTL and the FE hook's 30s refetch cadence.
 */
export const TRIP_DETAIL_TTL = 60; // 1 min
/** Operator label (transit:agency:v1:<feed>). */
export const AGENCY_TTL = 86_400; // 24 h — operator names barely change
/** Feed service-time range (transit:service-range:v1:<feed>). */
export const SERVICE_RANGE_TTL = 3_600; // 1 h
/** Line metadata + patterns (transit:line:v1:<gtfsId>). */
export const LINE_TTL = 1_800; // 30 min
/** Per-stop next-departure list for one line (transit:line-departures:v1:…). */
export const LINE_DEPARTURES_TTL = 60; // 1 min
/**
 * Bumped DEPARTURES_TTL slot for the v2 cache key — params expand to include
 * at / arriveBy / directionFilter / lineFilter / mode in the departures
 * surface. Old v1 keys time out naturally per the cache-key version-segment
 * policy; no flush required.
 */
export const DEPARTURES_V2_TTL = 60; // 1 min
