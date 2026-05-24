import { digitransitFinland } from "../digitransit-finland/index.js";
import { digitransitHsl } from "../digitransit-hsl/index.js";
import { digitransitWaltti } from "../digitransit-waltti/index.js";
import { digitransitVarely } from "../digitransit-varely/index.js";
import { AppError } from "../../utils/error-envelope.js";
import type { DigitransitAdapter } from "./adapter.js";

// HSL graph hosts HSL bus/tram/metro plus the HSLlautta (Suomenlinna ferry)
// feed. The Uber feed lives on the HSL endpoint too but is not transit, so
// it falls through to the Finland union.
export const HSL_PREFIXES = ["HSL", "HSLlautta"] as const;

// Waltti regional graphs. Prefix list pulled from a live
// `feeds { feedId }` query against the Waltti endpoint — re-run
// `pnpm --filter @reissulla/api exec tsx scripts/list-feeds.ts` whenever
// Digitransit announces a new participant.
//
// Cross-graph overlaps with Varely (Pori, Salo, FOLI, 02Taksi) route to
// Waltti since Waltti is the primary public-transport adapter for those
// cities; Varely keeps the ELY-only prefixes (VARELY, Rauma).
export const WALTTI_PREFIXES = [
  "Raasepori",
  "LINKKI",
  "Mikkeli",
  "tampere",
  "Hameenlinna",
  "FOLI",
  "OULU",
  "FUNI",
  "Rovaniemi",
  "Vaasa",
  "Pori",
  "Kuopio",
  "Kajaani",
  "Kotka",
  "Lahti",
  "Salo",
  "Kouvola",
  "Lappeenranta",
  "Joensuu",
] as const;

// Varely (ELY long-distance / rural) prefixes that do not overlap with a
// Waltti city. Confirmed via the same list-feeds helper.
export const VARELY_PREFIXES = ["VARELY", "Rauma"] as const;

const PREFIX_MAP: Record<string, () => DigitransitAdapter> = {
  ...Object.fromEntries(HSL_PREFIXES.map((p) => [p, () => digitransitHsl])),
  ...Object.fromEntries(
    WALTTI_PREFIXES.map((p) => [p, () => digitransitWaltti]),
  ),
  ...Object.fromEntries(
    VARELY_PREFIXES.map((p) => [p, () => digitransitVarely]),
  ),
};

// 503 because the upstream is fine — our config has every feed disabled.
// Distinct from the 502 TRANSIT_UNAVAILABLE that signals an actual outage.
function allFeedsDisabled(): never {
  throw new AppError(
    503,
    "TRANSIT_DISABLED",
    "All Digitransit transit feeds are disabled in server configuration",
    "self",
  );
}

/**
 * Route a gtfsId to the most-specific enabled adapter, falling back to
 * Finland (the union graph) when the prefix-specific adapter is disabled.
 * Throws AppError(503) when every feed is disabled.
 */
export function adapterForGtfsId(gtfsId: string): DigitransitAdapter {
  const prefix = gtfsId.split(":")[0] ?? "";
  const specific = PREFIX_MAP[prefix]?.();
  if (specific?.enabled()) return specific;
  if (digitransitFinland.enabled()) return digitransitFinland;
  return allFeedsDisabled();
}

/**
 * The default adapter for non-ID-bound queries (nearby, search, plan).
 * Picks Finland when enabled; otherwise the first enabled feed; otherwise throws.
 */
export function defaultAdapter(): DigitransitAdapter {
  if (digitransitFinland.enabled()) return digitransitFinland;
  if (digitransitHsl.enabled()) return digitransitHsl;
  return allFeedsDisabled();
}
