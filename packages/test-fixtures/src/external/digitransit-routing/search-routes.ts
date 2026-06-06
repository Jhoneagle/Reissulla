import type { GraphName } from "./index.js";

/**
 * Routes(name:) — fan-out registry keyed by `graph` + `name` query.
 * Cross-region "25" is the canonical scenario: HSL returns the local
 * tram, finland returns both 25s (HSL + Tampere) plus the 250 confuser,
 * varely returns empty, waltti returns Tampere bus 25.
 */

type Routes = { data: { routes: unknown[] } };

const hslTwentyFive: Routes = {
  data: {
    routes: [
      {
        gtfsId: "HSL:1025",
        shortName: "25",
        longName: "Itäkeskus - Mellunmäki",
        mode: "BUS",
        color: "00A6E2",
        textColor: "FFFFFF",
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
    ],
  },
};

const finlandTwentyFive: Routes = {
  data: {
    routes: [
      {
        gtfsId: "HSL:1025",
        shortName: "25",
        longName: "Itäkeskus - Mellunmäki",
        mode: "BUS",
        color: "00A6E2",
        textColor: "FFFFFF",
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
      {
        gtfsId: "tampere:25",
        shortName: "25",
        longName: "Reumasairaala - Hervanta",
        mode: "BUS",
        color: null,
        textColor: null,
        agency: {
          gtfsId: "tampere:Nysse",
          name: "Tampereen seudun joukkoliikenne",
        },
      },
      {
        gtfsId: "HSL:1250",
        shortName: "250",
        longName: "Helsinki - Bemböle",
        mode: "BUS",
        color: null,
        textColor: null,
        agency: { gtfsId: "HSL:HSL", name: "HSL" },
      },
    ],
  },
};

const varelyTwentyFive: Routes = { data: { routes: [] } };

const walttiTwentyFive: Routes = {
  data: {
    routes: [
      {
        gtfsId: "tampere:25",
        shortName: "25",
        longName: "Reumasairaala - Hervanta",
        mode: "BUS",
        color: null,
        textColor: null,
        agency: {
          gtfsId: "tampere:Nysse",
          name: "Tampereen seudun joukkoliikenne",
        },
      },
    ],
  },
};

export const searchRoutesByGraphAndQuery: Record<
  GraphName,
  Record<string, Routes>
> = {
  hsl: { "25": hslTwentyFive },
  finland: { "25": finlandTwentyFive },
  varely: { "25": varelyTwentyFive },
  waltti: { "25": walttiTwentyFive },
};

/** Used when a graph doesn't have a fixture for the query — empty, not 404. */
export const searchRoutesEmpty: Routes = { data: { routes: [] } };
