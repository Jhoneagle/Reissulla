/** Tolerance in degrees (~11 m) for treating two coordinates as the same location. */
export const COORD_TOLERANCE = 0.0001;

export function coordsMatch(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): boolean {
  return (
    Math.abs(lat1 - lat2) < COORD_TOLERANCE &&
    Math.abs(lon1 - lon2) < COORD_TOLERANCE
  );
}
