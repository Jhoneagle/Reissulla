import { LINE_TRAM_4 } from "../../scenarios.js";

/**
 * RouteWithPatterns(id:) responses keyed by GTFS route id. The line-view
 * page hits this endpoint to render the pattern picker + stops list.
 */

const lineTram4 = {
  data: {
    route: {
      gtfsId: LINE_TRAM_4.gtfsId,
      shortName: LINE_TRAM_4.shortName,
      longName: LINE_TRAM_4.longName,
      mode: "TRAM",
      color: "00985F",
      textColor: "FFFFFF",
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1004:0:01",
          headsign: "Munkkiniemi",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:1020452",
              name: "Rautatientori",
              lat: 60.1715,
              lon: 24.9412,
              code: "H0017",
              platformCode: null,
            },
            {
              gtfsId: "HSL:1040402",
              name: "Kauppatori",
              lat: 60.1683,
              lon: 24.9523,
              code: "H1027",
              platformCode: null,
            },
          ],
        },
        {
          code: "HSL:1004:1:01",
          headsign: "Katajanokka",
          directionId: 1,
          stops: [
            {
              gtfsId: "HSL:1040402",
              name: "Kauppatori",
              lat: 60.1683,
              lon: 24.9523,
              code: "H1027",
              platformCode: null,
            },
            {
              gtfsId: "HSL:1020452",
              name: "Rautatientori",
              lat: 60.1715,
              lon: 24.9412,
              code: "H0017",
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

const lineHsl1550 = {
  data: {
    route: {
      gtfsId: "HSL:1550",
      shortName: "550",
      longName: "Itäkeskus - Westendinasema",
      mode: "BUS",
      color: null,
      textColor: null,
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1550:0:01",
          headsign: "Westendinasema",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:STOP_A",
              name: "Itäkeskus",
              lat: 60.21,
              lon: 25.08,
              code: null,
              platformCode: null,
            },
            {
              gtfsId: "HSL:STOP_B",
              name: "Westendinasema",
              lat: 60.17,
              lon: 24.81,
              code: null,
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

/** Two-direction bus 550 fixture — exercises the LineView direction toggle. */
const lineHsl1059Bus550 = {
  data: {
    route: {
      gtfsId: "HSL:1059",
      shortName: "550",
      longName: "Itäkeskus - Westendinasema",
      mode: "BUS",
      color: "00A6E2",
      textColor: "FFFFFF",
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1059:0:01",
          headsign: "Westendinasema",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:1454102",
              name: "Itäkeskus",
              lat: 60.21,
              lon: 25.08,
              code: "T1234",
              platformCode: null,
            },
            {
              gtfsId: "HSL:2222204",
              name: "Westendinasema",
              lat: 60.17,
              lon: 24.81,
              code: "E2222",
              platformCode: null,
            },
          ],
        },
        {
          code: "HSL:1059:1:01",
          headsign: "Itäkeskus",
          directionId: 1,
          stops: [
            {
              gtfsId: "HSL:2222204",
              name: "Westendinasema",
              lat: 60.17,
              lon: 24.81,
              code: "E2222",
              platformCode: null,
            },
            {
              gtfsId: "HSL:1454102",
              name: "Itäkeskus",
              lat: 60.21,
              lon: 25.08,
              code: "T1234",
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

/** Single-direction tram 9 — verifies patterns.length === 1 path. */
const lineHsl1009Tram9 = {
  data: {
    route: {
      gtfsId: "HSL:1009",
      shortName: "9",
      longName: "Kolmikulma - Pasila",
      mode: "TRAM",
      color: null,
      textColor: null,
      agency: { gtfsId: "HSL:HSL", name: "HSL" },
      patterns: [
        {
          code: "HSL:1009:0:01",
          headsign: "Pasila",
          directionId: 0,
          stops: [
            {
              gtfsId: "HSL:1010101",
              name: "Kolmikulma",
              lat: 60.16,
              lon: 24.94,
              code: null,
              platformCode: null,
            },
          ],
        },
      ],
    },
  },
};

/** Variants of HSL:1550 used by line-departures.test.ts. Each carries the
 *  same route+pattern shape; the variant only matters for the matching
 *  line-departures fixture, which is keyed by the same gtfsId. */
function lineHsl1550WithGtfsId(gtfsId: string): unknown {
  return {
    data: {
      route: {
        ...(lineHsl1550 as { data: { route: Record<string, unknown> } }).data
          .route,
        gtfsId,
      },
    },
  };
}

export const routesByGtfsId: Record<string, unknown> = {
  [LINE_TRAM_4.gtfsId]: lineTram4,
  "HSL:1550": lineHsl1550,
  "HSL:1059": lineHsl1059Bus550,
  "HSL:1009": lineHsl1009Tram9,
  "HSL:1550-stopA-empty": lineHsl1550WithGtfsId("HSL:1550-stopA-empty"),
  "HSL:1550-out-of-order": lineHsl1550WithGtfsId("HSL:1550-out-of-order"),
  "HSL:1550-cached": lineHsl1550WithGtfsId("HSL:1550-cached"),
  "HSL:1550-single-fetch": lineHsl1550WithGtfsId("HSL:1550-single-fetch"),
};

export const routeNotFound = { data: { route: null } };
