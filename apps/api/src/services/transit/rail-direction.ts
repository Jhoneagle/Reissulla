/**
 * Commuter-rail direction heuristic — maps a terminus headsign to a
 * Finnish-readable direction label for the DEP-3 inbound/outbound split.
 *
 * The map is intentionally compact: only terminal endpoints that already
 * occur on Finnish commuter-rail routes are encoded. New stations get
 * added here as a code change so the labelling stays auditable and
 * doesn't depend on a feed quirk.
 *
 * The arrow glyph at the tail is part of the label — `ETELÄÄN ↓` reads
 * cleanly as "to the south, downward" both on the junat.net-style
 * heading and in screen-reader output.
 */
const SOUTH_TERMINI = new Set([
  "Helsinki",
  "Helsinki Asema",
  "Helsingin päärautatieasema",
  "Helsingin rautatieasema",
]);

/**
 * Endpoints that read as "outbound" from a central Helsinki perspective —
 * north, north-west, and east commuter-rail termini all bucket together
 * because what matters for the inbound/outbound split is the direction
 * away from the city core, not the compass quadrant. Long-distance VR
 * endpoints (Tampere, Kouvola, Vainikkala) round out the same bucket.
 */
const NORTH_TERMINI = new Set([
  "Riihimäki",
  "Tampere",
  "Lahti",
  "Kerava",
  "Korso",
  "Hämeenlinna",
  "Kirkkonummi",
  "Kauklahti",
  "Leppävaara",
  "Espoo",
  "Vainikkala",
  "Kouvola",
  "Kotka",
]);

const RING_HEADSIGNS = new Set([
  "Lentoasema",
  "Lentoasema (Airport)",
  "Lentoasema kehä",
  "Lentoasema-Myyrmäki",
  "Myyrmäki",
]);

export type RailDirectionLabel = "SOUTH" | "NORTH" | "RING" | "OTHER";

export interface RailDirectionResult {
  /** Coarse bucket — used for FE styling / aria. */
  bucket: RailDirectionLabel;
  /** Final visible label including arrow glyph. */
  label: string;
}

/**
 * Bucket and label a single headsign. Returns `OTHER` when the endpoint
 * doesn't match any known terminus — the caller is expected to fall
 * back to the raw headsign text for the visible label in that case.
 */
export function classifyRailHeadsign(headsign: string): RailDirectionResult {
  const trimmed = headsign.trim();
  if (RING_HEADSIGNS.has(trimmed)) return { bucket: "RING", label: "KEHÄ ↻" };
  if (SOUTH_TERMINI.has(trimmed)) {
    return { bucket: "SOUTH", label: "ETELÄÄN ↓" };
  }
  if (NORTH_TERMINI.has(trimmed)) {
    return { bucket: "NORTH", label: "POHJOISEEN ↑" };
  }
  // Trips often carry a compound headsign like "Korso via Malmi-Tikkurila"
  // or "Lentoasema-Myyrmäki via Oulunkylä-Tikkurila". Match against the
  // primary endpoint (before "via" or "-") so the bucket still resolves
  // for the same train rendered with route detail in the headsign.
  const primary = trimmed.split(/\s+via\s+|-/)[0]?.trim() ?? trimmed;
  if (primary !== trimmed) {
    if (SOUTH_TERMINI.has(primary)) {
      return { bucket: "SOUTH", label: "ETELÄÄN ↓" };
    }
    if (NORTH_TERMINI.has(primary)) {
      return { bucket: "NORTH", label: "POHJOISEEN ↑" };
    }
    if (RING_HEADSIGNS.has(primary)) {
      return { bucket: "RING", label: "KEHÄ ↻" };
    }
  }
  // Unknown endpoint — keep the raw headsign so the FE has something to
  // show; the bucket lets it style "unknown" rows differently if needed.
  return { bucket: "OTHER", label: trimmed };
}
