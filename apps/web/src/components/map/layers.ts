/**
 * Map base-layer + overlay registry. Single source of truth for tile URLs,
 * attribution, zoom envelopes, and subdomain pools. The wire-shape `LayerId`
 * union lives in `@reissulla/shared` because IDs are persisted in
 * `preferences.extra.layerDefaults` and round-trip through share URLs.
 *
 * VITE_MAP_TILE_BASE_URL overrides `tile-streets` only — keeps the OSM swap a
 * one-line lever for self-hosted / paid providers. The remaining streets
 * stubs (`tile-satellite`, `tile-terrain`, `tile-transit`) need a paid
 * provider; until one is wired they render the streets template so the
 * LayerControl UI stays operable.
 */

import type { LayerId } from "@reissulla/shared";

export type { LayerId };
export {
  LAYER_IDS,
  BASE_LAYER_IDS,
  isLayerId,
  isBaseLayerId,
} from "@reissulla/shared";

export type LayerKind = "base" | "overlay";

export type LayerSource =
  | {
      type: "url";
      template: string;
      subdomains?: string;
    }
  | { type: "wms"; baseUrl: string; layer: string }
  | { type: "internal" };

export interface LayerConfig {
  id: LayerId;
  kind: LayerKind;
  source: LayerSource;
  attribution: string;
  minZoom?: number;
  maxZoom?: number;
}

const OSM_DEFAULT = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

const CARTO_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const CARTO_SUBDOMAINS = "abcd";
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION}, &copy; <a href="https://carto.com/attributions">CARTO</a>`;

const OSM_HOT = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const OSM_HOT_SUBDOMAINS = "abc";
const OSM_HOT_ATTRIBUTION = `${OSM_ATTRIBUTION}, tiles courtesy of <a href="https://www.openstreetmap.fr/">Humanitarian OSM</a>`;

const envTileBase = (import.meta.env.VITE_MAP_TILE_BASE_URL ?? "").trim();
const streetsTemplate = envTileBase !== "" ? envTileBase : OSM_DEFAULT;

export const LAYERS: Record<LayerId, LayerConfig> = {
  "tile-streets": {
    id: "tile-streets",
    kind: "base",
    source: { type: "url", template: streetsTemplate },
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  "tile-satellite": {
    id: "tile-satellite",
    kind: "base",
    source: { type: "url", template: streetsTemplate },
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  "tile-terrain": {
    id: "tile-terrain",
    kind: "base",
    source: { type: "url", template: streetsTemplate },
    attribution: OSM_ATTRIBUTION,
    maxZoom: 17,
  },
  "tile-dark": {
    id: "tile-dark",
    kind: "base",
    source: { type: "url", template: CARTO_DARK, subdomains: CARTO_SUBDOMAINS },
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 19,
  },
  "tile-hc": {
    id: "tile-hc",
    kind: "base",
    source: { type: "url", template: OSM_HOT, subdomains: OSM_HOT_SUBDOMAINS },
    attribution: OSM_HOT_ATTRIBUTION,
    maxZoom: 19,
  },
  "tile-transit": {
    id: "tile-transit",
    kind: "base",
    source: { type: "url", template: streetsTemplate },
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  "overlay-stops": {
    id: "overlay-stops",
    kind: "overlay",
    source: { type: "internal" },
    attribution: "",
  },
  "overlay-lines": {
    id: "overlay-lines",
    kind: "overlay",
    source: { type: "internal" },
    attribution: "",
  },
  "overlay-rain-radar": {
    id: "overlay-rain-radar",
    kind: "overlay",
    source: { type: "internal" },
    attribution: "",
  },
  "overlay-warnings": {
    id: "overlay-warnings",
    kind: "overlay",
    source: { type: "internal" },
    attribution: "",
  },
  "overlay-vehicles": {
    id: "overlay-vehicles",
    kind: "overlay",
    // Rendered from the per-line SSE stream, not a tile source — the
    // dots are drawn by <VehicleLayer> on the LineView map.
    source: { type: "internal" },
    attribution: "Digitransit / HSL",
  },
};

export const DEFAULT_BASE_LAYER: LayerId = "tile-streets";
export const DEFAULT_OVERLAYS: readonly LayerId[] = ["overlay-stops"] as const;
