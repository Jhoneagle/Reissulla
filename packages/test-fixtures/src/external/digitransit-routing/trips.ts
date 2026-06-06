import { TRIP_TRAM_4_MORNING } from "../../scenarios.js";

/**
 * Trip(id:) responses keyed by GTFS trip id. The `HSL:`/`tampere:`/etc.
 * prefix makes keys globally unique, so we don't need to also key by
 * graph — the request URL's graph picks the registry only as a sanity
 * check (a trip id is only ever queried against its owning graph).
 */

const tripTram4Morning = {
  data: {
    trip: {
      gtfsId: TRIP_TRAM_4_MORNING.gtfsId,
      tripHeadsign: TRIP_TRAM_4_MORNING.headsign,
      directionId: 0,
      serviceId: "HSL:1004_20251021_Ke",
      pattern: {
        code: "HSL:1004:0:01",
        headsign: TRIP_TRAM_4_MORNING.headsign,
      },
      route: {
        gtfsId: TRIP_TRAM_4_MORNING.routeGtfsId,
        shortName: TRIP_TRAM_4_MORNING.routeShortName,
        longName: "Katajanokka - Munkkiniemi",
        mode: "TRAM",
        color: "00985F",
        textColor: "FFFFFF",
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
      stoptimes: [
        {
          stop: {
            gtfsId: "HSL:1020452",
            name: "Rautatientori",
            code: "H0017",
            platformCode: null,
          },
          scheduledArrival: 27000,
          scheduledDeparture: 27000,
          realtimeArrival: null,
          realtimeDeparture: null,
          arrivalDelay: null,
          departureDelay: null,
          realtime: null,
          pickupType: "SCHEDULED",
          dropoffType: "SCHEDULED",
        },
        {
          stop: {
            gtfsId: "HSL:1040402",
            name: "Kauppatori",
            code: "H1027",
            platformCode: null,
          },
          scheduledArrival: 27240,
          scheduledDeparture: 27240,
          realtimeArrival: null,
          realtimeDeparture: null,
          arrivalDelay: null,
          departureDelay: null,
          realtime: null,
          pickupType: "SCHEDULED",
          dropoffType: "SCHEDULED",
        },
      ],
    },
  },
};

const tripWithCanceledStop = {
  data: {
    trip: {
      gtfsId: "HSL:4_22550_2410211146_canceled",
      tripHeadsign: TRIP_TRAM_4_MORNING.headsign,
      directionId: 0,
      serviceId: "HSL:1004_20251021_Ke",
      pattern: {
        code: "HSL:1004:0:01",
        headsign: TRIP_TRAM_4_MORNING.headsign,
      },
      route: {
        gtfsId: TRIP_TRAM_4_MORNING.routeGtfsId,
        shortName: TRIP_TRAM_4_MORNING.routeShortName,
        longName: "Katajanokka - Munkkiniemi",
        mode: "TRAM",
        color: "00985F",
        textColor: "FFFFFF",
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
      stoptimes: [
        {
          stop: {
            gtfsId: "HSL:1020452",
            name: "Rautatientori",
            code: "H0017",
            platformCode: null,
          },
          scheduledArrival: 27000,
          scheduledDeparture: 27000,
          realtimeArrival: null,
          realtimeDeparture: null,
          arrivalDelay: null,
          departureDelay: null,
          realtime: null,
          pickupType: "CANCELLED",
          dropoffType: "CANCELLED",
        },
      ],
    },
  },
};

export const tripsByGtfsId: Record<string, unknown> = {
  [TRIP_TRAM_4_MORNING.gtfsId]: tripTram4Morning,
  "HSL:4_22550_2410211146_canceled": tripWithCanceledStop,
};

export const tripNotFound = { data: { trip: null } };
