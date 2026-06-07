import type { Persona } from "./persona.js";
import type { LayerId } from "./map-layers.js";

export type TemperatureUnit = "celsius" | "fahrenheit";
export type DistanceUnit = "metric" | "imperial";
export type TimeFormat = "24h" | "12h";
export type Language = "fi" | "en";
export type Theme = "light" | "dark" | "system";
export type ReduceMotion = "on" | "off" | "system";

export interface LayerDefaults {
  baseLayer: LayerId;
  overlays: LayerId[];
}

export interface PreferencesExtra {
  persona?: Persona;
  /**
   * Map base layer + overlay set the user picked last. Narrowed to known
   * `LayerId` values; the server-side parser drops unknown strings rather
   * than throwing so an old client that wrote a now-removed ID still loads.
   */
  layerDefaults?: LayerDefaults;
  /**
   * Set to true when the user dismisses the Settings persona-setup
   * banner. Suppresses re-display on subsequent visits. Cleared
   * automatically when persona is configured (the banner stops
   * rendering anyway). Server-side parseExtra must preserve this
   * field on round-trip; see apps/api/src/db/repositories/preferences-extra.ts.
   */
  personaBannerDismissed?: boolean;
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
