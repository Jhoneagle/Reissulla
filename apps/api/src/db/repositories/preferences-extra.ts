import { DEFAULT_PERSONA, type Persona } from "@reissulla/shared";

/**
 * Typed shape of the `preferences.extra` jsonb column. Kept here (next to the
 * preferences repo) so callers get a typed object instead of `unknown` for the
 * raw jsonb value.
 *
 * - `persona` is the persona profile stored for authenticated users; the wire
 *   header reads from this when no `x-reissulla-persona` is present.
 * - `layerDefaults` is reserved for Phase 3's map-overlay preferences
 *   (PREF-16). Defined as a loose record now so writing the path doesn't need
 *   a migration; Phase 3 will narrow the type when it actually consumes it.
 *
 * `parseExtra` is tolerant of malformed jsonb so a corrupt row doesn't break
 * the request path — bad fields fall back to defaults rather than throwing.
 */
export interface PreferencesExtra {
  persona?: Persona;
  layerDefaults?: Record<string, unknown>;
  personaBannerDismissed?: boolean;
}

export function parseExtra(raw: unknown): PreferencesExtra {
  if (typeof raw !== "object" || raw === null) return {};

  const r = raw as Record<string, unknown>;
  const extra: PreferencesExtra = {};

  const persona = parsePersona(r.persona);
  if (persona) extra.persona = persona;

  if (typeof r.layerDefaults === "object" && r.layerDefaults !== null) {
    extra.layerDefaults = r.layerDefaults as Record<string, unknown>;
  }

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

/**
 * Serialise a `PreferencesExtra` for jsonb storage. Today this is the
 * identity function; the helper exists so any future shape evolution
 * (e.g. dropping a deprecated field on write) has a single chokepoint.
 */
export function serializeExtra(extra: PreferencesExtra): PreferencesExtra {
  return extra;
}

export { DEFAULT_PERSONA };
