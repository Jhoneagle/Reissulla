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

/**
 * Placeholder shapes — the warning, road-condition, and nowcast wire
 * contracts firm up in Chunks 3 and 5. The snapshot payload already
 * carries these fields from Chunk 1, so the FE accepts them as opaque
 * until their consumers land.
 */
export type WeatherWarning = Record<string, unknown>;
export type RoadConditionSnapshot = Record<string, unknown>;
export type RainNowcastSnapshot = Record<string, unknown>;

export interface WeatherSnapshot {
  current: CurrentWeather | null;
  forecast: WeatherForecast | null;
  airQuality: AirQualitySnapshot | null;
  pollen: PollenSnapshot | null;
  warnings: WeatherWarning[];
  roadConditions: RoadConditionSnapshot | null;
  nowcast: RainNowcastSnapshot | null;
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
