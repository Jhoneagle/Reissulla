/**
 * Digitransit Pelias fixtures keyed by request query / coordinates.
 *
 * The Pelias HTTP surface has four endpoints — autocomplete, search,
 * search/structured, reverse — and each can be driven independently from
 * its own registry. Tests pick scenarios via the request text / lat-lon.
 */

export type PeliasFeatureCollection = {
  type: "FeatureCollection";
  features: unknown[];
};

export interface PeliasErrorMarker {
  /** Discriminator — handler returns the given HTTP status when this is set. */
  readonly httpError: number;
}

export type PeliasFixture = PeliasFeatureCollection | PeliasErrorMarker;

export function isErrorMarker(value: unknown): value is PeliasErrorMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { httpError?: unknown }).httpError === "number"
  );
}

export {
  autocompleteByText,
  searchByText,
  searchStructuredByText,
  reverseByCoord,
} from "./registries.js";
