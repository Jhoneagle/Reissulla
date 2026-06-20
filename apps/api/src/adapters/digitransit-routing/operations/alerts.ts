import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawAlert, RawAlertsData } from "../types.js";

// Service-level alerts (delays, cancellations, planned disruptions). The
// header / description are requested in both fi and en via the per-field
// `language` argument (the `*Translations` fields are deprecated upstream).
// `entities` replaces the deprecated single `route` / `stop` selectors and
// lets one alert name every affected route or stop.
const ALERTS_QUERY = `
  query Alerts {
    alerts {
      id
      alertHeaderTextFi: alertHeaderText(language: "fi")
      alertHeaderTextEn: alertHeaderText(language: "en")
      alertDescriptionTextFi: alertDescriptionText(language: "fi")
      alertDescriptionTextEn: alertDescriptionText(language: "en")
      alertCause
      alertEffect
      alertSeverityLevel
      effectiveStartDate
      effectiveEndDate
      entities {
        __typename
        ... on Route {
          gtfsId
        }
        ... on Stop {
          gtfsId
        }
      }
    }
  }
`;

export async function alertsOperation(
  client: GraphQLClient,
  ctx: AdapterContext,
): Promise<RawAlert[]> {
  const raw = await client.graphql<RawAlertsData>(ALERTS_QUERY, {}, ctx);
  return raw.alerts;
}
