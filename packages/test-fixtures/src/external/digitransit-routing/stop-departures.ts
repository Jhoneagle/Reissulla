/**
 * StopDepartures(id:) — keyed by GTFS stop id. The /api/v1/transit/departures
 * route resolves a single stop and returns its next departures.
 */

export type StopDeparturesErrorMarker =
  | { kind: "http-error"; status: number }
  | { kind: "network-error" };

export type StopDeparturesFixture = {
  data: {
    stop: null | {
      name: string;
      stoptimesWithoutPatterns: unknown[];
    };
  };
};

export type StopDeparturesRegistryEntry =
  | StopDeparturesFixture
  | StopDeparturesErrorMarker;

export function isStopDeparturesErrorMarker(
  v: StopDeparturesRegistryEntry,
): v is StopDeparturesErrorMarker {
  return "kind" in v;
}

const rautatientori: StopDeparturesFixture = {
  data: {
    stop: {
      name: "Rautatientori",
      stoptimesWithoutPatterns: [
        {
          scheduledDeparture: 43200,
          realtimeDeparture: 43230,
          departureDelay: 30,
          realtime: true,
          serviceDay: 1778101200,
          headsign: "Westendinasema",
          trip: {
            route: {
              shortName: "550",
              longName: "Itäkeskus-Westendinasema",
              mode: "BUS",
            },
          },
        },
        {
          scheduledDeparture: 43500,
          realtimeDeparture: 43500,
          departureDelay: 0,
          realtime: false,
          serviceDay: 1778101200,
          headsign: "Kamppi",
          trip: {
            route: {
              shortName: "14",
              longName: "Hernesaari-Kamppi",
              mode: "TRAM",
            },
          },
        },
      ],
    },
  },
};

const nullStop: StopDeparturesFixture = { data: { stop: null } };

export const stopDeparturesByGtfsId: Record<
  string,
  StopDeparturesRegistryEntry
> = {
  "HSL:1040602": rautatientori,
  "UNKNOWN:9999": nullStop,
  "HSL:1040602-network-error": { kind: "network-error" },
};

export const stopDeparturesEmpty: StopDeparturesFixture = nullStop;
