import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawAlert, RawAlertsData } from "../types.js";

// Service-level alerts (delays, cancellations, planned disruptions). Lands
// now so the operations directory is complete; the notification-centre
// consumer wires in a later phase.
const ALERTS_QUERY = `
  query Alerts {
    alerts {
      alertHeaderText
      alertDescriptionText
      alertSeverityLevel
      effectiveStartDate
      effectiveEndDate
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
