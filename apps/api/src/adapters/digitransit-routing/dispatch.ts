import { digitransitFinland } from "../digitransit-finland/index.js";
import { digitransitHsl } from "../digitransit-hsl/index.js";
import type { DigitransitAdapter } from "./adapter.js";
import { DigitransitError } from "./errors.js";

const PREFIX_MAP: Record<string, () => DigitransitAdapter> = {
  HSL: () => digitransitHsl,
  // Phase 2: tampere → digitransitWaltti, lippu → digitransitVarely, …
};

/**
 * Route a gtfsId to the most-specific enabled adapter, falling back to
 * Finland (the union graph) when the prefix-specific adapter is disabled.
 * Throws DigitransitError if no adapter can serve the request.
 */
export function adapterForGtfsId(gtfsId: string): DigitransitAdapter {
  const prefix = gtfsId.split(":")[0] ?? "";
  const specific = PREFIX_MAP[prefix]?.();
  if (specific?.enabled()) return specific;
  if (digitransitFinland.enabled()) return digitransitFinland;
  throw new DigitransitError(
    "self",
    "graphql",
    "All Digitransit feeds disabled",
  );
}

/**
 * The default adapter for non-ID-bound queries (nearby, search, plan).
 * Picks Finland when enabled; otherwise the first enabled feed; otherwise throws.
 */
export function defaultAdapter(): DigitransitAdapter {
  if (digitransitFinland.enabled()) return digitransitFinland;
  if (digitransitHsl.enabled()) return digitransitHsl;
  throw new DigitransitError(
    "self",
    "graphql",
    "All Digitransit feeds disabled",
  );
}
