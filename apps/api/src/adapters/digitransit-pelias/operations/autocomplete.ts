import type { AdapterContext } from "../../types.js";
import type { PeliasClient, PeliasFeature } from "../client.js";

export interface AutocompleteArgs {
  text: string;
  size?: number;
  focus?: { lat: number; lon: number };
  /** Pelias layer filter, e.g. "localadmin,station" for cities + stations. */
  layers?: string;
  /** ISO-3166-1 alpha-2 country bound. Defaults to "FI". */
  country?: string;
  /** Display language. Defaults to "fi". */
  lang?: string;
}

// Live-as-you-type prefix matching. Good for short queries; the `search`
// endpoint is preferred when the input looks like a full address.
export async function autocompleteOperation(
  client: PeliasClient,
  args: AutocompleteArgs,
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

  const json = await client.request("autocomplete", params, ctx);
  return json.features;
}
