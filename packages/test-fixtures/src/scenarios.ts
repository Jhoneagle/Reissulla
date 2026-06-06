/**
 * Symbolic test scenarios — each maps to a concrete upstream identifier.
 *
 * Tests reference scenarios by name (TRIP_TRAM_4_MORNING, LINE_TRAM_4, …)
 * so that intent stays readable even when the underlying GTFS id rotates
 * with a feed refresh. The id lives here and in the registry key; nowhere
 * else.
 */

export const TRIP_TRAM_4_MORNING = {
  /** GTFS trip id, prefixed with the feed code. */
  gtfsId: "HSL:4_22550_2410211146",
  routeGtfsId: "HSL:1004",
  routeShortName: "4",
  headsign: "Munkkiniemi",
} as const;

export const LINE_TRAM_4 = {
  gtfsId: "HSL:1004",
  shortName: "4",
  longName: "Katajanokka - Munkkiniemi",
} as const;

export const STOP_RAUTATIENTORI = {
  /** GTFS stop id. */
  gtfsId: "HSL:1020452",
  name: "Rautatientori",
  lat: 60.1715,
  lon: 24.9412,
} as const;

/** Helsinki coordinates used by the canonical weather fixture. */
export const HELSINKI_COORD = {
  lat: 60.17,
  lon: 24.94,
} as const;

/**
 * Synthetic coordinates that the MSW handler maps to HTTP error responses.
 * The real Open-Meteo API never returns these as valid request inputs, so
 * tests can use them to drive deterministic error paths.
 */
export const WEATHER_ERROR_COORD = {
  lat: 1.01,
  lon: 1.01,
} as const;

export const WEATHER_NETWORK_ERROR_COORD = {
  lat: 1.02,
  lon: 1.02,
} as const;
