import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawAgency, RawAgencyData } from "../types.js";

// Operator label for cross-region itineraries — turns a route into "HSL",
// "VR", "Nysse" etc. Cached at the service layer because operator names
// barely change.
const AGENCY_QUERY = `
  query Agency($id: String!) {
    agency(id: $id) {
      gtfsId
      name
    }
  }
`;

export async function agencyOperation(
  client: GraphQLClient,
  args: { agencyId: string },
  ctx: AdapterContext,
): Promise<RawAgency | null> {
  const raw = await client.graphql<RawAgencyData>(
    AGENCY_QUERY,
    { id: args.agencyId },
    ctx,
  );
  return raw.agency;
}
