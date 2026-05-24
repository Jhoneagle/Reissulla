import { useEffect, useRef } from "react";
import { useMapStore } from "../stores/map";
import { useAuthStore } from "../stores/auth";
import { useRecordVisit } from "./useRecentPlaces";

/**
 * LOC-8 writer half. Phase 1 shipped the recent-places API route +
 * the `<RecentPlacesList>` reader, but no part of the app calls
 * `useRecordVisit` — so the list was permanently empty in practice.
 *
 * This hook watches the map store's selected location and records a
 * visit when the user lands on a *named* place (search-result click,
 * saved-marker click, or any future selection that arrives with a
 * name attached). Raw map clicks that fire with only `{ lat, lon }`
 * intentionally do not record — recent-places should be places, not
 * exploratory taps. Once the unnamed click resolves to a name via
 * reverse-geocoding the caller can update `selectedLocation` and we
 * pick it up then.
 *
 * Dedup: a ref tracks the last-recorded lat/lon (5 decimal places —
 * about 1 m precision). Selecting the same point twice in a row
 * doesn't double-record. Selecting a different point, or the same
 * point after a different one, does.
 */
export function useRecordSelectedVisit(): void {
  const user = useAuthStore((s) => s.user);
  const selectedLocation = useMapStore((s) => s.selectedLocation);
  const { mutate } = useRecordVisit();
  const lastRecordedRef = useRef<string | null>(null);

  // Reset the dedup ref when the user signs out so the next sign-in
  // doesn't silently swallow the first selection (the previous user's
  // key would still match if the same point gets clicked again).
  useEffect(() => {
    if (!user) lastRecordedRef.current = null;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!selectedLocation) return;
    if (!selectedLocation.name) return;

    const key = `${selectedLocation.lat.toFixed(5)},${selectedLocation.lon.toFixed(5)}`;
    if (lastRecordedRef.current === key) return;
    lastRecordedRef.current = key;

    mutate({
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lon,
      displayName: selectedLocation.name,
    });
  }, [user, selectedLocation, mutate]);
}
