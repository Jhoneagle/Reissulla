import type { TransitStop, TransitSubStop } from "@reissulla/shared";
import type {
  RawStationChildStop,
  RawSearchStopsAndStationsData,
} from "../../adapters/digitransit-routing/types.js";

/**
 * Normalize stop name for grouping — strip platform suffixes like "(M)", "(A)", etc.
 * "Itäkeskus (M)" → "itäkeskus", "Itäkeskus" → "itäkeskus"
 */
export function normalizeStopName(name: string): string {
  return name
    .replace(/\s*\([^)]{1,3}\)\s*$/, "")
    .toLowerCase()
    .trim();
}

interface GroupedEntry {
  stop: TransitStop;
  subStops: Map<string, TransitSubStop>;
}

/**
 * Group stops and stations by normalized name AND vehicle mode.
 * Each (name, mode) pair becomes one search result entry.
 * Stations are split into separate entries per child-stop mode.
 */
export function groupStopsByNameAndMode(
  stops: RawSearchStopsAndStationsData["stops"],
  stations: RawSearchStopsAndStationsData["stations"],
): TransitStop[] {
  const grouped = new Map<string, GroupedEntry>();

  for (const st of stations) {
    const normalizedName = normalizeStopName(st.name);

    const childrenByMode = new Map<string, RawStationChildStop[]>();
    for (const child of st.stops) {
      const mode = child.vehicleMode ?? "UNKNOWN";
      const list = childrenByMode.get(mode) ?? [];
      list.push(child);
      childrenByMode.set(mode, list);
    }

    if (childrenByMode.size === 0 && st.vehicleMode) {
      const key = `${normalizedName}|${st.vehicleMode}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          stop: {
            gtfsId: st.gtfsId,
            name: st.name,
            code: null,
            lat: st.lat,
            lon: st.lon,
            vehicleMode: st.vehicleMode,
            platformCode: null,
            isStation: true,
            vehicleModes: [st.vehicleMode],
          },
          subStops: new Map(),
        });
      }
    }

    for (const [mode, children] of childrenByMode) {
      const key = `${normalizedName}|${mode}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = {
          stop: {
            gtfsId: st.gtfsId,
            name: st.name,
            code: null,
            lat: st.lat,
            lon: st.lon,
            vehicleMode: mode,
            platformCode: null,
            isStation: true,
            vehicleModes: [mode],
          },
          subStops: new Map(),
        };
        grouped.set(key, entry);
      }
      for (const child of children) {
        entry.subStops.set(child.gtfsId, {
          gtfsId: child.gtfsId,
          code: child.code,
          platformCode: child.platformCode,
          vehicleMode: child.vehicleMode,
        });
      }
    }
  }

  for (const s of stops) {
    const mode = s.vehicleMode ?? "UNKNOWN";
    const key = `${normalizeStopName(s.name)}|${mode}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        stop: {
          gtfsId: s.gtfsId,
          name: s.name,
          code: s.code,
          lat: s.lat,
          lon: s.lon,
          vehicleMode: s.vehicleMode,
          platformCode: s.platformCode,
          isStation: false,
          vehicleModes: [mode],
        },
        subStops: new Map(),
      };
      grouped.set(key, entry);
    }
    entry.subStops.set(s.gtfsId, {
      gtfsId: s.gtfsId,
      code: s.code,
      platformCode: s.platformCode,
      vehicleMode: s.vehicleMode,
    });
  }

  return Array.from(grouped.values()).map(({ stop, subStops }) => ({
    ...stop,
    subStops: Array.from(subStops.values()),
  }));
}
