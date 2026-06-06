import type { GraphName } from "./index.js";

/**
 * NearbyStops(lat, lon, radius) responses, keyed by `${lat.toFixed(3)},${lon.toFixed(3)}`.
 * The error markers let tests drive transport-level failures from specific
 * coordinates while keeping the handler set closed.
 */

export type NearestErrorMarker =
  | { kind: "http-error"; status: number }
  | { kind: "network-error" };

export type NearestFixture = {
  data: { nearest: { edges: unknown[] } };
};

export type NearestRegistryEntry = NearestFixture | NearestErrorMarker;

export function isNearestErrorMarker(
  v: NearestRegistryEntry,
): v is NearestErrorMarker {
  return "kind" in v;
}

const helsinkiNearby: NearestFixture = {
  data: {
    nearest: {
      edges: [
        {
          node: {
            distance: 120,
            place: {
              gtfsId: "HSL:1040602",
              name: "Rautatientori",
              code: "0612",
              lat: 60.1709,
              lon: 24.9432,
              vehicleMode: "BUS",
              platformCode: null,
            },
          },
        },
        {
          node: {
            distance: 250,
            place: {
              gtfsId: "HSL:1040601",
              name: "Rautatientori",
              code: "0611",
              lat: 60.1705,
              lon: 24.9428,
              vehicleMode: "TRAM",
              platformCode: "1",
            },
          },
        },
      ],
    },
  },
};

const empty: NearestFixture = { data: { nearest: { edges: [] } } };

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Helsinki (60.17, 24.94) returns the canonical 2-stop set on every graph
 * — production fans out and merges. Other graphs return empty so the API
 * doesn't surface duplicates.
 */
export const nearestByGraphAndCoord: Record<
  GraphName,
  Record<string, NearestRegistryEntry>
> = {
  hsl: {
    [coordKey(60.17, 24.94)]: helsinkiNearby,
    [coordKey(60.55, 24.55)]: empty,
  },
  finland: {
    [coordKey(60.17, 24.94)]: empty,
    // error-envelope.test.ts drives the upstream-failure path via this coord.
    // The finland adapter surfaces first in the router fan-out, so the
    // error envelope identifies it as the failing source.
    [coordKey(60.55, 24.55)]: { kind: "network-error" },
  },
  varely: {
    [coordKey(60.17, 24.94)]: empty,
    [coordKey(60.55, 24.55)]: empty,
  },
  waltti: {
    [coordKey(60.17, 24.94)]: empty,
    [coordKey(60.55, 24.55)]: empty,
  },
};

export const nearestEmpty: NearestFixture = empty;
export const nearestCoordKey = coordKey;
