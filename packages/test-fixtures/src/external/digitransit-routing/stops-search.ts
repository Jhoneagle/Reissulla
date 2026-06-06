import type { GraphName } from "./index.js";

/**
 * SearchStopsAndStations(name:) — keyed by graph + normalized query.
 * Drives /api/v1/transit/stops/search test scenarios.
 */

export type StopsSearchErrorMarker = { kind: "http-error"; status: number };

export type StopsSearchFixture = {
  data: {
    stops: unknown[];
    stations: unknown[];
  };
};

export type StopsSearchRegistryEntry =
  | StopsSearchFixture
  | StopsSearchErrorMarker;

export function isStopsSearchErrorMarker(
  v: StopsSearchRegistryEntry,
): v is StopsSearchErrorMarker {
  return "kind" in v;
}

const rautatientoriHits: StopsSearchFixture = {
  data: {
    stops: [
      {
        gtfsId: "HSL:1040602",
        name: "Rautatientori",
        code: "0612",
        lat: 60.1709,
        lon: 24.9432,
        vehicleMode: "BUS",
        platformCode: null,
      },
    ],
    stations: [
      {
        gtfsId: "HSL:1000003",
        name: "Rautatientori",
        lat: 60.171,
        lon: 24.9435,
        vehicleMode: "SUBWAY",
        stops: [
          {
            gtfsId: "HSL:1000003_1",
            name: "Rautatientori",
            code: "M112",
            platformCode: "1",
            vehicleMode: "SUBWAY",
          },
        ],
      },
    ],
  },
};

const empty: StopsSearchFixture = { data: { stops: [], stations: [] } };

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export const stopsSearchByGraphAndName: Record<
  GraphName,
  Record<string, StopsSearchRegistryEntry>
> = {
  hsl: {
    [normalize("Rautatientori")]: empty,
    [normalize("Rautatientori-error")]: empty,
  },
  finland: {
    // adapterRouter.forSearch() returns the Finland-wide adapter today,
    // so the canonical fixtures live here.
    [normalize("Rautatientori")]: rautatientoriHits,
    [normalize("Rautatientori-error")]: { kind: "http-error", status: 503 },
  },
  varely: {
    [normalize("Rautatientori")]: empty,
    [normalize("Rautatientori-error")]: empty,
  },
  waltti: {
    [normalize("Rautatientori")]: empty,
    [normalize("Rautatientori-error")]: empty,
  },
};

export const stopsSearchEmpty: StopsSearchFixture = empty;
export const normalizeStopsSearchName = normalize;
