/**
 * Geographic extent of Finland for map fallbacks.
 * Used when GPS, primary-saved, and last-viewed all fail to produce a center.
 */
export const FINLAND_BOUNDS = {
  south: 59.5,
  north: 70.1,
  west: 19.0,
  east: 31.6,
} as const;

/**
 * Approximate centroid of Finland — for when a single lat/lon is needed
 * instead of bounds (initial map center on first load with no GPS).
 */
export const FINLAND_CENTER = {
  lat: 64.8,
  lon: 25.3,
} as const;
