import { DEFAULT_PERSONA, type Persona } from "../types/persona.js";

/**
 * Wire format for the `x-reissulla-persona` header. Compact, stable, and
 * deterministic so it doubles as the cache-key fingerprint.
 *
 * Shape: `wheelchair=1;lowFloor=1;noStairs=0;stroller=0;sr=0;lv=0;lang=fi`
 *
 * - Booleans encoded as `0` / `1`.
 * - Field order is fixed and matches `Persona` declaration order.
 * - Unknown fields are ignored on parse — forward-compatible when new flags
 *   are added in later phases.
 * - Malformed values fall back to defaults rather than throwing; an
 *   incoherent header should not break the request.
 */

const BOOLEAN_KEYS: { wire: string; field: keyof Persona }[] = [
  { wire: "wheelchair", field: "wheelchair" },
  { wire: "lowFloor", field: "lowFloor" },
  { wire: "noStairs", field: "noStairs" },
  { wire: "stroller", field: "stroller" },
  { wire: "sr", field: "screenReader" },
  { wire: "lv", field: "lowVision" },
];

export function serializePersona(persona: Persona): string {
  const parts = BOOLEAN_KEYS.map(
    ({ wire, field }) => `${wire}=${persona[field] ? 1 : 0}`,
  );
  parts.push(`lang=${persona.language}`);
  return parts.join(";");
}

export function parsePersona(header: string | undefined | null): Persona {
  if (!header) return { ...DEFAULT_PERSONA };

  const persona: Persona = { ...DEFAULT_PERSONA };
  const wireKeyToField = new Map(BOOLEAN_KEYS.map((k) => [k.wire, k.field]));

  for (const rawToken of header.split(";")) {
    const token = rawToken.trim();
    if (!token) continue;

    const eq = token.indexOf("=");
    if (eq <= 0) continue;

    const key = token.slice(0, eq).trim();
    const value = token.slice(eq + 1).trim();

    const field = wireKeyToField.get(key);
    if (field) {
      (persona[field] as boolean) = value === "1";
      continue;
    }

    if (key === "lang" && (value === "fi" || value === "en")) {
      persona.language = value;
    }
  }

  return persona;
}
