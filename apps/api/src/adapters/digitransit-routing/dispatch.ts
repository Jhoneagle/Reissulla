import { digitransitFinland } from "../digitransit-finland/index.js";
import { digitransitHsl } from "../digitransit-hsl/index.js";
import { AppError } from "../../utils/error-envelope.js";
import type { DigitransitAdapter } from "./adapter.js";

const PREFIX_MAP: Record<string, () => DigitransitAdapter> = {
  HSL: () => digitransitHsl,
  // Phase 2: tampere → digitransitWaltti, lippu → digitransitVarely, …
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
