import type { AdapterContext } from "../../types.js";
import type { PeliasClient, PeliasFeature } from "../client.js";

export interface SearchArgs {
  text: string;
  size?: number;
  focus?: { lat: number; lon: number };
  layers?: string;
  country?: string;
  lang?: string;
}

// Address-style full search — better than `autocomplete` at matching
// house numbers and full street strings.
export async function searchOperation(
  client: PeliasClient,
  args: SearchArgs,
  ctx: AdapterContext,
): Promise<PeliasFeature[]> {
  const params = new URLSearchParams({
    text: args.text,
    "boundary.country": args.country ?? "FI",
    lang: args.lang ?? "fi",
  });
  if (args.size !== undefined) params.set("size", String(args.size));
  if (args.focus) {
    params.set("focus.point.lat", String(args.focus.lat));
    params.set("focus.point.lon", String(args.focus.lon));
  }
  if (args.layers) params.set("layers", args.layers);

  const json = await client.request("search", params, ctx);
  return json.features;
}
