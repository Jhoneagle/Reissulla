import type { Persona } from "./persona.js";

export type TemperatureUnit = "celsius" | "fahrenheit";
export type DistanceUnit = "metric" | "imperial";
export type TimeFormat = "24h" | "12h";
export type Language = "fi" | "en";
export type Theme = "light" | "dark" | "system";
export type ReduceMotion = "on" | "off" | "system";

export interface PreferencesExtra {
  persona?: Persona;
  layerDefaults?: Record<string, unknown>;
}

export interface Preferences {
  id: string;
  userId: string;
  temperatureUnit: TemperatureUnit;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  language: Language;
  transitRegion: string;
  theme: Theme;
  reduceMotion: ReduceMotion;
  highContrast: boolean;
  /** Percent: 100 = browser default, 200 = doubled. */
  fontScale: number;
  srOptimised: boolean;
  extra: PreferencesExtra;
  updatedAt: string;
}

export interface PreferencesPatch {
  temperatureUnit?: TemperatureUnit;
  distanceUnit?: DistanceUnit;
  timeFormat?: TimeFormat;
  language?: Language;
  theme?: Theme;
  reduceMotion?: ReduceMotion;
  highContrast?: boolean;
  fontScale?: number;
  srOptimised?: boolean;
  extra?: PreferencesExtra;
}
