// Cache TTLs in seconds, consolidated so they're discoverable in one place.
// Bump alongside the cache-key version segment when the value shape changes.

export const WEATHER_CURRENT_TTL = 900; // 15 min — Open-Meteo updates hourly
export const WEATHER_FORECAST_TTL = 1800; // 30 min

export const GEOCODE_SEARCH_TTL = 86_400; // 24 h — places don't move
export const GEOCODE_REVERSE_TTL = 86_400; // 24 h

export const STOPS_TTL = 3_600; // 1 h — stops rarely move
export const DEPARTURES_TTL = 60; // 1 min — needs to feel fresh
export const PLAN_TTL = 300; // 5 min — itineraries decay with traffic
