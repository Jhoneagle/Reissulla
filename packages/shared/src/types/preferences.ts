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

/** How much detail each live-region announcement carries (A11Y-29). */
export type Verbosity = "terse" | "standard" | "verbose";
/**
 * How fast the user reads announcements (A11Y-23). Governs the multi-line
 * coalesce window — a slower pace groups close-together announcements into one
 * so there's time to absorb them. NOT speech rate (the browser can't set that).
 */
export type ReadingPace = "slow" | "normal" | "fast";

export interface LiveRegionPrefs {
  verbosity: Verbosity;
  readingPace: ReadingPace;
}

/** Defaults applied when the user has not set live-region preferences. */
export const DEFAULT_LIVE_REGION: LiveRegionPrefs = {
  verbosity: "standard",
  readingPace: "normal",
};

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
  /**
   * Live-region announcement tuning (A11Y-23 reading pace + A11Y-29
   * verbosity). Server-side parseExtra validates each member against its
   * literal union and drops unknown values to the default rather than
   * throwing; see apps/api/src/db/repositories/preferences-extra.ts.
   */
  liveRegion?: LiveRegionPrefs;
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
