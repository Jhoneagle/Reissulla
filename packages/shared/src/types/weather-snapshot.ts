import type { CurrentWeather, WeatherForecast } from "./weather.js";

export interface AirQualitySnapshot {
  europeanAqi: number;
  pm10: number;
  pm2_5: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  ozone: number;
  carbonMonoxide: number;
  timestamp: string;
}

export interface PollenSnapshot {
  alder?: number;
  birch?: number;
  grass?: number;
  mugwort?: number;
  olive?: number;
  ragweed?: number;
  timestamp: string;
}

export type WeatherWarningSeverity =
  | "minor"
  | "moderate"
  | "severe"
  | "extreme";

export type WeatherWarningType =
  | "wind"
  | "rain"
  | "snow"
  | "ice"
  | "cold"
  | "heat"
  | "thunder"
  | "fog";

/** GeoJSON polygon mirror — kept generic so the FE doesn't import API types. */
export interface WarningGeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface WeatherWarning {
  id: string;
  severity: WeatherWarningSeverity;
  type: WeatherWarningType;
  /** Unix ms — when the warning becomes / became active. */
  startTime: number;
  /** Unix ms — when the warning auto-expires. Banner dismissal honours this. */
  endTime: number;
  region: string;
  /** Locale-resolved human text. fi or en depending on persona / Accept-Language. */
  description: string;
  /**
   * Polygon bounds used by the API to intersect against the requested
   * coord; carried through to the FE so the Chunk 4 map overlay can
   * draw the polygon without a second round trip.
   */
  bounds?: WarningGeoJsonPolygon;
}

export type RoadSurfaceStateSnapshot =
  | "dry"
  | "wet"
  | "moist-salty"
  | "frosty"
  | "snowy"
  | "icy"
  | "partly-icy";

export interface RoadConditionSnapshot {
  sectionId: number;
  sectionName: string;
  surfaceState: RoadSurfaceStateSnapshot | null;
  /** Free-form upstream weather text, locale-neutral. */
  weather: string | null;
  /** °C, null when not measured. */
  roadTemperature: number | null;
  /** Distance from the requested coord to the section centroid, km. */
  distanceKm: number;
  /** ISO-8601 timestamp from upstream. */
  observedAt: string;
}

export type RainNowcastState =
  | "no-rain"
  | "rain-incoming"
  | "raining"
  | "rain-ending";

export type NowcastFlavor = "rain" | "snow";

/**
 * Accessible rain nowcast — combines FMI radar intensity with Open-Meteo
 * hourly precipitation probability into a small state machine. `flavor`
 * is decided from the latest hourly WMO code so the snow ramp + copy can
 * fork without a second round-trip. `textFi` / `textEn` are pre-rendered
 * via `nowcast-format.ts` and consumed by the dashboard live region.
 */
export interface RainNowcast {
  state: RainNowcastState;
  flavor: NowcastFlavor;
  /** Required when `state === "rain-incoming"`. */
  minutesUntilStart?: number;
  /**
   * For `raining`, the elapsed duration of the band so far (minutes).
   * For `rain-ending`, the expected forward minutes before it stops.
   */
  estimatedDurationMin?: number;
  textFi: string;
  textEn: string;
}

/** @deprecated retained for Chunk 1 callers; use `RainNowcast` directly. */
export type RainNowcastSnapshot = RainNowcast;

export interface WeatherSnapshot {
  current: CurrentWeather | null;
  forecast: WeatherForecast | null;
  airQuality: AirQualitySnapshot | null;
  pollen: PollenSnapshot | null;
  warnings: WeatherWarning[];
  roadConditions: RoadConditionSnapshot | null;
  nowcast: RainNowcast | null;
}

export interface WeatherSnapshotSourceMeta {
  cached: boolean;
  failed: boolean;
}

export interface WeatherSnapshotMeta {
  current: WeatherSnapshotSourceMeta;
  forecast: WeatherSnapshotSourceMeta;
  airQuality: WeatherSnapshotSourceMeta;
  pollen: WeatherSnapshotSourceMeta;
  warnings: WeatherSnapshotSourceMeta;
  roadConditions: WeatherSnapshotSourceMeta;
  nowcast: WeatherSnapshotSourceMeta;
}
