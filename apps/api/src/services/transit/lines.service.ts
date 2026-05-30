import { DEFAULT_PERSONA, type Line, type Persona } from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { LINE_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { routesOperation } from "../../adapters/digitransit-routing/operations/routes.js";
import type { AdapterContext } from "../../adapters/types.js";
import { adapterRouter } from "./adapter-router.js";

function makeContext(persona: Persona): AdapterContext {
  return { signal: new AbortController().signal, persona };
}

/**
 * Catalogue search by short or long name. The upstream's `routes(name:)`
 * filter is a substring match against both fields, so "25" surfaces every
 * route whose name contains "25" — across feeds when the adapter is the
 * Finland-wide union (the default for `region="all"` or unset). The result
 * is sorted shortName-length ascending so exact-length matches surface
 * before noisier wider matches (e.g. "1" before "11" before "111").
 *
 * Region semantics differ from `searchStops`: here `region` picks the
 * Digitransit graph to query (matching `preferences.transitRegion`), not
 * a city locality filter. An unknown region falls through to the Finland
 * adapter rather than 400-ing — the FE facet vocabulary may grow without
 * a synchronised backend update.
 */
export async function searchLines(
  query: string,
  region: string | undefined,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: Line[]; cached: boolean }> {
  const normalisedQuery = query.trim().toLowerCase();
  const regionKey = region?.trim().toLowerCase() || "all";

  const key = cacheKey("transit", "line-search", 1, regionKey, normalisedQuery);
  const cached = await tryCache(() => cacheGet<Line[]>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forRegion(regionKey);
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx = makeContext(persona);

  const raw = await routesOperation(client, { name: query.trim() }, ctx);

  // Exact-length matches surface first so "25" doesn't bury Tampere 25 /
  // HSL 25 behind 250, 25A, etc. when the upstream substring-matches.
  const sorted = [...raw].sort(
    (a, b) => a.shortName.length - b.shortName.length,
  );

  const data: Line[] = sorted.map((r) => ({
    gtfsId: r.gtfsId,
    shortName: r.shortName,
    longName: r.longName,
    mode: r.mode,
    color: r.color,
    textColor: r.textColor,
    // Line.agency is optional; coerce upstream null to undefined so the
    // wire shape omits the field rather than carrying a JSON `null` that
    // consumers would need to defend against.
    agency: r.agency ?? undefined,
  }));

  await tryCache(() => cacheSet(key, data, LINE_TTL));
  return { data, cached: false };
}
