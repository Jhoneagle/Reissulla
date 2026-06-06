/**
 * Map base-layer + overlay registry. Single source of truth for tile URLs,
 * attribution, and zoom envelopes. The UI consumer (LayerControl) ships in
 * a later chunk; this file is the placeholder that gives the OSM swap a
 * one-line lever (`VITE_MAP_TILE_BASE_URL` overrides `tile-streets`) and
 * locks in the LayerId union the rest of the system will reference.
 */

export type LayerId =
  | "tile-streets"
  | "tile-satellite"
  | "tile-terrain"
  | "tile-dark"
  | "tile-hc"
  | "tile-transit"
  | "overlay-stops"
  | "overlay-lines"
  | "overlay-rain-radar"
  | "overlay-warnings";

export type LayerKind = "base" | "overlay";

export type LayerSource =
  | { type: "url"; template: string }
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

// Escape hatch — point at any `{z}/{x}/{y}.png` provider (MapTiler, Stadia,
// self-hosted) without code changes. Empty / unset = stay on OSM.
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
    source: { type: "url", template: streetsTemplate },
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  "tile-hc": {
    id: "tile-hc",
    kind: "base",
    source: { type: "url", template: streetsTemplate },
    attribution: OSM_ATTRIBUTION,
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
};

export const DEFAULT_BASE_LAYER: LayerId = "tile-streets";
export const DEFAULT_OVERLAYS: readonly LayerId[] = ["overlay-stops"] as const;
