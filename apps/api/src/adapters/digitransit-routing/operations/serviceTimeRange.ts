import type { AdapterContext } from "../../types.js";
import type { GraphQLClient } from "../client.js";
import type { RawServiceTimeRange, RawServiceTimeRangeData } from "../types.js";

// Feed's service-date envelope — used to clamp future-time pickers and to
// surface "no schedule available" for far-future requests.
const SERVICE_TIME_RANGE_QUERY = `
  query ServiceTimeRange {
    serviceTimeRange {
      start
      end
    }
  }
`;

export async function serviceTimeRangeOperation(
  client: GraphQLClient,
  ctx: AdapterContext,
): Promise<RawServiceTimeRange> {
  const raw = await client.graphql<RawServiceTimeRangeData>(
    SERVICE_TIME_RANGE_QUERY,
    {},
    ctx,
  );
  return raw.serviceTimeRange;
}
