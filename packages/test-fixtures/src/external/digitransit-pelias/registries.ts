import type { PeliasFixture } from "./index.js";

const mannerheimintieSearch = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [24.9384, 60.1699] },
      properties: {
        id: "way/123",
        gid: "openstreetmap:street:way/123",
        layer: "street",
        source: "openstreetmap",
        name: "Mannerheimintie",
        label: "Mannerheimintie, Helsinki",
        confidence: 0.9,
        locality: "Helsinki",
        neighbourhood: "Etu-Töölö",
      },
    },
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [23.761, 61.4978] },
      properties: {
        id: "way/456",
        gid: "openstreetmap:street:way/456",
        layer: "street",
        source: "openstreetmap",
        name: "Mannerheimintie",
        label: "Mannerheimintie, Tampere",
        confidence: 0.7,
        locality: "Tampere",
      },
    },
  ],
};

const emptyFeatureCollection = {
  type: "FeatureCollection" as const,
  features: [],
};

const rautatientoriReverse = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [24.9414, 60.171] },
      properties: {
        id: "node/654",
        gid: "openstreetmap:venue:node/654",
        layer: "venue",
        source: "openstreetmap",
        name: "Rautatientori",
        label: "Rautatientori, Helsinki",
        confidence: 1.0,
        locality: "Helsinki",
        neighbourhood: "Kluuvi",
        street: "Rautatientori",
        postalcode: "00100",
        country: "Suomi",
        region: "Uusimaa",
      },
    },
  ],
};

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/** Lowercase, trimmed, replaces interior whitespace with single spaces. */
function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export const autocompleteByText: Record<string, PeliasFixture> = {
  [normalizeQuery("Mannerheimintie")]: mannerheimintieSearch,
  // Drives the "returns 502 when Digitransit is down" path in geocoding.test.ts.
  // The search service uses autocomplete for non-address queries.
  [normalizeQuery("Helsinki")]: { httpError: 503 },
};

export const searchByText: Record<string, PeliasFixture> = {
  // Address-like queries (contains a digit) hit /search.
  [normalizeQuery("xyznonexistent12345")]: emptyFeatureCollection,
};

export const searchStructuredByText: Record<string, PeliasFixture> = {
  [normalizeQuery("Mannerheimintie")]: mannerheimintieSearch,
};

export const reverseByCoord: Record<string, PeliasFixture> = {
  [coordKey(60.171, 24.9414)]: rautatientoriReverse,
  // (60.17, 24.94) — drives the "network error" path in geocoding.test.ts
  [coordKey(60.17, 24.94)]: { httpError: 0 },
  [coordKey(0, 0)]: emptyFeatureCollection,
};

export const peliasUtils = { coordKey, normalizeQuery };
