import {
  DEFAULT_LIVE_REGION,
  DEFAULT_PERSONA,
  HISTORY_RETENTION_DAYS_MAX,
  HISTORY_RETENTION_DAYS_MIN,
  isLayerId,
  type LayerDefaults,
  type LayerId,
  type LiveRegionPrefs,
  type Persona,
  type ReadingPace,
  type Verbosity,
} from "@reissulla/shared";

/**
 * Typed shape of the `preferences.extra` jsonb column. Kept here (next to the
 * preferences repo) so callers get a typed object instead of `unknown` for the
 * raw jsonb value.
 *
 * - `persona` is the persona profile stored for authenticated users; the wire
 *   header reads from this when no `x-reissulla-persona` is present.
 * - `layerDefaults` is the map base-layer + overlay set the user picked last
 *   (PREF-16). Validated against the canonical `LayerId` union; unknown
 *   strings are dropped rather than throwing so an old client that wrote a
 *   now-removed ID still loads.
 *
 * `parseExtra` is tolerant of malformed jsonb so a corrupt row doesn't break
 * the request path — bad fields fall back to defaults rather than throwing.
 */
export interface PreferencesExtra {
  persona?: Persona;
  layerDefaults?: LayerDefaults;
  personaBannerDismissed?: boolean;
  liveRegion?: LiveRegionPrefs;
  historyRetentionDays?: number;
}

export function parseExtra(raw: unknown): PreferencesExtra {
  if (typeof raw !== "object" || raw === null) return {};

  const r = raw as Record<string, unknown>;
  const extra: PreferencesExtra = {};

  const persona = parsePersona(r.persona);
  if (persona) extra.persona = persona;

  const layerDefaults = parseLayerDefaults(r.layerDefaults);
  if (layerDefaults) extra.layerDefaults = layerDefaults;

  if (r.personaBannerDismissed === true) {
    extra.personaBannerDismissed = true;
  }

  const liveRegion = parseLiveRegion(r.liveRegion);
  if (liveRegion) extra.liveRegion = liveRegion;

  const historyRetentionDays = parseHistoryRetentionDays(
    r.historyRetentionDays,
  );
  if (historyRetentionDays !== undefined) {
    extra.historyRetentionDays = historyRetentionDays;
  }

  return extra;
}

/**
 * Validate the trip-log retention window. A non-number is dropped (the
 * consumer applies the 90-day default); a number is rounded and clamped to
 * [7, 365] so a buggy or hostile client can't write `99999` and keep rows
 * forever. Clamps rather than throws, matching the tolerant-parse precedent.
 */
function parseHistoryRetentionDays(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const rounded = Math.round(raw);
  return Math.min(
    HISTORY_RETENTION_DAYS_MAX,
    Math.max(HISTORY_RETENTION_DAYS_MIN, rounded),
  );
}

function parsePersona(raw: unknown): Persona | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;

  return {
    wheelchair: r.wheelchair === true,
    lowFloor: r.lowFloor === true,
    noStairs: r.noStairs === true,
    stroller: r.stroller === true,
    screenReader: r.screenReader === true,
    lowVision: r.lowVision === true,
    language: r.language === "fi" ? "fi" : "en",
  };
}

function parseLayerDefaults(raw: unknown): LayerDefaults | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;

  if (!isLayerId(r.baseLayer)) return undefined;

  const overlays: LayerId[] = [];
  if (Array.isArray(r.overlays)) {
    const seen = new Set<LayerId>();
    for (const item of r.overlays) {
      if (isLayerId(item) && !seen.has(item)) {
        seen.add(item);
        overlays.push(item);
      }
    }
  }

  return { baseLayer: r.baseLayer, overlays };
}

const VERBOSITIES: readonly Verbosity[] = ["terse", "standard", "verbose"];
const READING_PACES: readonly ReadingPace[] = ["slow", "normal", "fast"];

/**
 * Parse the live-region tuning bag. Each member is validated against its
 * literal union; an unknown value falls back to the default rather than
 * throwing, matching the tolerant parseLayerDefaults precedent. Returns
 * undefined only when the input isn't an object at all, so a partial write
 * (e.g. just `verbosity`) still round-trips with the other member defaulted.
 */
function parseLiveRegion(raw: unknown): LiveRegionPrefs | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;

  const verbosity = VERBOSITIES.includes(r.verbosity as Verbosity)
    ? (r.verbosity as Verbosity)
    : DEFAULT_LIVE_REGION.verbosity;
  const readingPace = READING_PACES.includes(r.readingPace as ReadingPace)
    ? (r.readingPace as ReadingPace)
    : DEFAULT_LIVE_REGION.readingPace;

  return { verbosity, readingPace };
}

/**
 * Serialise a `PreferencesExtra` for jsonb storage. Today this is the
 * identity function; the helper exists so any future shape evolution
 * (e.g. dropping a deprecated field on write) has a single chokepoint.
 */
export function serializeExtra(extra: PreferencesExtra): PreferencesExtra {
  return extra;
}

export { DEFAULT_PERSONA };
