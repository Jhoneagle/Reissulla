/**
 * Raw Fintraffic Digitraffic Road API shapes. Only the fields we actually
 * consume are typed; extra payload from upstream is ignored at runtime.
 */

export interface FintrafficRawForecast {
  time: string;
  forecastName: string;
  roadCondition: string | null;
  weather: string | null;
  roadTemperature: number | null;
}

export interface FintrafficRawSection {
  id: number;
  sectionName: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  forecast: FintrafficRawForecast[];
}

export interface FintrafficRawResponse {
  dataUpdatedTime: string;
  weatherData: FintrafficRawSection[];
}

export type RoadSurfaceState =
  | "dry"
  | "wet"
  | "moist-salty"
  | "frosty"
  | "snowy"
  | "icy"
  | "partly-icy";

export interface RoadCondition {
  sectionId: number;
  sectionName: string;
  /** Surface state, lowercased + normalized. null if upstream gave null. */
  surfaceState: RoadSurfaceState | null;
  /** Free-form weather hazard text from upstream, locale-neutral. */
  weather: string | null;
  /** °C, null when not measured. */
  roadTemperature: number | null;
  /** Distance from the requested coordinate to the section centroid, km. */
  distanceKm: number;
  /** ISO-8601 timestamp from upstream `dataUpdatedTime`. */
  observedAt: string;
}

const KNOWN_SURFACE_STATES: ReadonlySet<RoadSurfaceState> = new Set([
  "dry",
  "wet",
  "moist-salty",
  "frosty",
  "snowy",
  "icy",
  "partly-icy",
]);

/**
 * Normalize the upstream `roadCondition` enum string to our internal kebab-case
 * surface state. Upstream values are SCREAMING_SNAKE_CASE; we lowercase, swap
 * underscores for hyphens, then strip the trailing `-salt` so
 * `MOIST_AND_SALTY` collapses to `moist-salty`. Unknown / empty → null.
 *
 * Exported so the unit test can pin the full mapping table.
 */
export function mapSurfaceState(raw: string | null): RoadSurfaceState | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/-and-/g, "-")
    .replace(/-salt$/, "");
  return (KNOWN_SURFACE_STATES as Set<string>).has(normalized)
    ? (normalized as RoadSurfaceState)
    : null;
}
