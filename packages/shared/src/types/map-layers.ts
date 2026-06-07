/**
 * Map layer IDs as wire shape. The visual registry (tile URLs, attribution,
 * zoom envelopes) lives FE-side in `apps/web/src/components/map/layers.ts`,
 * but the IDs themselves are persisted in `preferences.extra.layerDefaults`
 * and round-trip through share URLs, so they belong in the shared package.
 */

export const LAYER_IDS = [
  "tile-streets",
  "tile-satellite",
  "tile-terrain",
  "tile-dark",
  "tile-hc",
  "tile-transit",
  "overlay-stops",
  "overlay-lines",
  "overlay-rain-radar",
  "overlay-warnings",
] as const;

export type LayerId = (typeof LAYER_IDS)[number];

const LAYER_ID_SET: ReadonlySet<string> = new Set(LAYER_IDS);

export function isLayerId(value: unknown): value is LayerId {
  return typeof value === "string" && LAYER_ID_SET.has(value);
}

export const BASE_LAYER_IDS = [
  "tile-streets",
  "tile-satellite",
  "tile-terrain",
  "tile-dark",
  "tile-hc",
  "tile-transit",
] as const satisfies readonly LayerId[];

export type BaseLayerId = (typeof BASE_LAYER_IDS)[number];

const BASE_LAYER_ID_SET: ReadonlySet<string> = new Set(BASE_LAYER_IDS);

export function isBaseLayerId(value: unknown): value is BaseLayerId {
  return typeof value === "string" && BASE_LAYER_ID_SET.has(value);
}
