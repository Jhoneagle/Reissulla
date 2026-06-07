import {
  DEFAULT_PERSONA,
  isLayerId,
  type LayerDefaults,
  type LayerId,
  type Persona,
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

  return extra;
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

/**
 * Serialise a `PreferencesExtra` for jsonb storage. Today this is the
 * identity function; the helper exists so any future shape evolution
 * (e.g. dropping a deprecated field on write) has a single chokepoint.
 */
export function serializeExtra(extra: PreferencesExtra): PreferencesExtra {
  return extra;
}

export { DEFAULT_PERSONA };
