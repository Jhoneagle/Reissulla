import { getFeatureFlags } from "../../services/featureFlag.service.js";
import type { DigitransitAdapter } from "../digitransit-routing/adapter.js";
import { createGraphQLClient } from "../digitransit-routing/client.js";
import { nearestOperation } from "../digitransit-routing/operations/nearest.js";
import { planConnectionOperation } from "../digitransit-routing/operations/planConnection.js";
import { searchStopsAndStationsOperation } from "../digitransit-routing/operations/searchStopsAndStations.js";
import { stationDeparturesOperation } from "../digitransit-routing/operations/stationDepartures.js";
import { stopDeparturesOperation } from "../digitransit-routing/operations/stopDepartures.js";

const FINLAND_URL = "https://api.digitransit.fi/routing/v2/finland/gtfs/v1";

const client = createGraphQLClient("digitransit-finland", FINLAND_URL);

export const digitransitFinland: DigitransitAdapter = {
  name: "digitransit-finland",
  graphUrl: FINLAND_URL,
  enabled: () => getFeatureFlags().feed.finland,
  nearest: (lat, lon, radius, ctx) =>
    nearestOperation(client, { lat, lon, radius }, ctx),
  searchStopsAndStations: (name, ctx) =>
    searchStopsAndStationsOperation(client, { name }, ctx),
  stopDepartures: (stopId, n, ctx) =>
    stopDeparturesOperation(client, { stopId, n }, ctx),
  stationDepartures: (stationId, n, ctx) =>
    stationDeparturesOperation(client, { stationId, n }, ctx),
  planConnection: (args, ctx) => planConnectionOperation(client, args, ctx),
};
