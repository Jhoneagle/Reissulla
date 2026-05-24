import type { AdapterContext } from "../../types.js";
import type { PeliasClient, PeliasFeature } from "../client.js";

export interface ReverseArgs {
  lat: number;
  lon: number;
  size?: number;
  layers?: string;
  lang?: string;
}

// Reverse geocoding — coordinate → nearest feature(s). `size: 1` is the
// canonical "give me the locality / address" call.
export async function reverseOperation(
  client: PeliasClient,
  args: ReverseArgs,
  ctx: AdapterContext,
): Promise<PeliasFeature[]> {
  const params = new URLSearchParams({
    "point.lat": String(args.lat),
    "point.lon": String(args.lon),
    lang: args.lang ?? "fi",
  });
  if (args.size !== undefined) params.set("size", String(args.size));
  if (args.layers) params.set("layers", args.layers);

  const json = await client.request("reverse", params, ctx);
  return json.features;
}
