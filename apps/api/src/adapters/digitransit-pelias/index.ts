import type { AdapterContext } from "../types.js";
import {
  createPeliasClient,
  type PeliasClient,
  type PeliasFeature,
} from "./client.js";
import {
  autocompleteOperation,
  type AutocompleteArgs,
} from "./operations/autocomplete.js";
import { searchOperation, type SearchArgs } from "./operations/search.js";
import { reverseOperation, type ReverseArgs } from "./operations/reverse.js";
import {
  structuredSearchOperation,
  type StructuredSearchArgs,
} from "./operations/structured-search.js";

const PELIAS_URL = "https://api.digitransit.fi/geocoding/v1";

export interface DigitransitPeliasAdapter {
  readonly source: "digitransit-pelias";
  readonly baseUrl: string;
  autocomplete(
    args: AutocompleteArgs,
    ctx: AdapterContext,
  ): Promise<PeliasFeature[]>;
  search(args: SearchArgs, ctx: AdapterContext): Promise<PeliasFeature[]>;
  reverse(args: ReverseArgs, ctx: AdapterContext): Promise<PeliasFeature[]>;
  structuredSearch(
    args: StructuredSearchArgs,
    ctx: AdapterContext,
  ): Promise<PeliasFeature[]>;
}

function buildAdapter(client: PeliasClient): DigitransitPeliasAdapter {
  return {
    source: "digitransit-pelias",
    baseUrl: client.baseUrl,
    autocomplete: (args, ctx) => autocompleteOperation(client, args, ctx),
    search: (args, ctx) => searchOperation(client, args, ctx),
    reverse: (args, ctx) => reverseOperation(client, args, ctx),
    structuredSearch: (args, ctx) =>
      structuredSearchOperation(client, args, ctx),
  };
}

export const digitransitPelias: DigitransitPeliasAdapter = buildAdapter(
  createPeliasClient(PELIAS_URL),
);
