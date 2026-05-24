import type { AdapterContext } from "../../types.js";
import type { PeliasClient, PeliasFeature } from "../client.js";

export interface StructuredSearchArgs {
  /** Free-text venue / address fragment. */
  address?: string;
  /** Locality / city name — e.g. "Helsinki". Backs the region facet. */
  locality?: string;
  /** Admin region — e.g. "Uusimaa". */
  region?: string;
  /** Larger admin area (county). */
  county?: string;
  /** Postal code. */
  postalcode?: string;
  size?: number;
  country?: string;
  lang?: string;
}

// Structured query — Pelias' `/v1/search/structured` lets callers pin a
// region facet so "Rautatieasema" + locality="Helsinki" returns Pasila
// rather than Tampere's railway station.
export async function structuredSearchOperation(
  client: PeliasClient,
  args: StructuredSearchArgs,
  ctx: AdapterContext,
): Promise<PeliasFeature[]> {
  const params = new URLSearchParams({
    "boundary.country": args.country ?? "FI",
    lang: args.lang ?? "fi",
  });
  if (args.address) params.set("address", args.address);
  if (args.locality) params.set("locality", args.locality);
  if (args.region) params.set("region", args.region);
  if (args.county) params.set("county", args.county);
  if (args.postalcode) params.set("postalcode", args.postalcode);
  if (args.size !== undefined) params.set("size", String(args.size));

  const json = await client.request("search/structured", params, ctx);
  return json.features;
}
