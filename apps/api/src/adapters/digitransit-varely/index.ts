import { getFeatureFlags } from "../../services/featureFlag.service.js";
import type { DigitransitAdapter } from "../digitransit-routing/adapter.js";
import { createGraphQLClient } from "../digitransit-routing/client.js";
import { nearestOperation } from "../digitransit-routing/operations/nearest.js";
import { planConnectionOperation } from "../digitransit-routing/operations/planConnection.js";
import { searchStopsAndStationsOperation } from "../digitransit-routing/operations/searchStopsAndStations.js";
import { stationDeparturesOperation } from "../digitransit-routing/operations/stationDepartures.js";
import { stopDeparturesOperation } from "../digitransit-routing/operations/stopDepartures.js";

const VARELY_URL = "https://api.digitransit.fi/routing/v2/varely/gtfs/v1";

const client = createGraphQLClient("digitransit-varely", VARELY_URL);

export const digitransitVarely: DigitransitAdapter = {
  name: "digitransit-varely",
  graphUrl: VARELY_URL,
  enabled: () => getFeatureFlags().feed.varely,
  nearest: (lat, lon, radius, ctx) =>
    nearestOperation(client, { lat, lon, radius }, ctx),
  searchStopsAndStations: (name, ctx) =>
    searchStopsAndStationsOperation(client, { name }, ctx),
  stopDepartures: (args, ctx) => stopDeparturesOperation(client, args, ctx),
  stationDepartures: (args, ctx) =>
    stationDeparturesOperation(client, args, ctx),
  planConnection: (args, ctx) => planConnectionOperation(client, args, ctx),
};
