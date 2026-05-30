import {
  DEFAULT_PERSONA,
  type DirectionId,
  type Line,
  type LineStopDeparture,
  type LineView,
  type Pattern,
  type PatternStop,
  type Persona,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { LINE_DEPARTURES_TTL, LINE_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { routesOperation } from "../../adapters/digitransit-routing/operations/routes.js";
import { routeWithPatternsOperation } from "../../adapters/digitransit-routing/operations/routeWithPatterns.js";
import {
  HSL_PREFIXES,
  VARELY_PREFIXES,
  WALTTI_PREFIXES,
} from "../../adapters/digitransit-routing/dispatch.js";
import type { AdapterContext } from "../../adapters/types.js";
import { NotFoundError } from "../../utils/error-envelope.js";
import { adapterRouter } from "./adapter-router.js";
import { getStopDepartures } from "./departures.service.js";

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

/**
 * Maximum number of stops we'll fan out a per-stop departure fetch across.
 * Real-world patterns rarely exceed 60 stops; an adversarial gtfsId
 * shouldn't blow the upstream budget, so we truncate.
 */
const MAX_PATTERN_STOPS = 60;
const LINE_DEPARTURES_MAX_PARALLEL = 10;
/** How many departures to ask `getStopDepartures` to surface per stop. */
const LINE_DEPARTURE_FETCH_COUNT = 20;

function pickPattern(
  patterns: Pattern[],
  directionId: DirectionId | undefined,
): Pattern | undefined {
  if (patterns.length === 0) return undefined;
  if (directionId === undefined) return patterns[0];
  return patterns.find((p) => p.directionId === directionId) ?? patterns[0];
}

/**
 * Per-stop "next departure for this line" enrichment, fanned out across
 * the chosen pattern's stops. Consumes the shared `transit:departures:v2`
 * slot via `getStopDepartures` — line filtering is the edge transform, not
 * an upstream parameter (cache-source-filter-at-edge memory rule). The
 * line-departures slot caches the *resulting* per-line projection so the
 * fan-out runs once per (line, direction) per cache window.
 */
export async function getLineDepartures(
  gtfsId: string,
  directionId: DirectionId | undefined,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: LineStopDeparture[]; cached: boolean }> {
  const key = cacheKey(
    "transit",
    "line-departures",
    1,
    gtfsId,
    directionId === undefined ? "any" : String(directionId),
  );
  const cached = await tryCache(() => cacheGet<LineStopDeparture[]>(key));
  if (cached) return { data: cached, cached: true };

  const { data: line } = await getLine(gtfsId, persona);
  const pattern = pickPattern(line.patterns, directionId);
  if (!pattern) {
    await tryCache(() => cacheSet(key, [], LINE_DEPARTURES_TTL));
    return { data: [], cached: false };
  }

  const stops = pattern.stops.slice(0, MAX_PATTERN_STOPS);

  const results: LineStopDeparture[] = [];
  for (let i = 0; i < stops.length; i += LINE_DEPARTURES_MAX_PARALLEL) {
    const batch = stops.slice(i, i + LINE_DEPARTURES_MAX_PARALLEL);
    const batchResults = await Promise.all(
      batch.map((stop) => fetchStopNextForLine(stop, gtfsId, persona)),
    );
    results.push(...batchResults);
  }

  await tryCache(() => cacheSet(key, results, LINE_DEPARTURES_TTL));
  return { data: results, cached: false };
}

async function fetchStopNextForLine(
  stop: PatternStop,
  lineGtfsId: string,
  persona: Persona,
): Promise<LineStopDeparture> {
  const empty: LineStopDeparture = {
    stop,
    nextDepartureUnix: null,
    scheduledDepartureUnix: null,
    delaySec: 0,
    realtime: false,
    headwayMin: null,
  };

  try {
    const { data } = await getStopDepartures(
      stop.gtfsId,
      LINE_DEPARTURE_FETCH_COUNT,
      false,
      persona,
    );
    // Filter the per-stop superset down to this line. routeGtfsId is the
    // stable identifier; fall back to routeShortName when an older cached
    // payload lacks the field (60s TTL bounds the legacy window).
    const onLine = data.departures.filter(
      (d) =>
        d.routeGtfsId === lineGtfsId ||
        (d.routeGtfsId === undefined && d.routeShortName === lineGtfsId),
    );
    if (onLine.length === 0) return empty;

    const earliest = onLine[0]!;
    const headwayMin = averageHeadwayMin(onLine);

    return {
      stop,
      nextDepartureUnix:
        earliest.serviceDay + (earliest.realtimeDeparture ?? 0),
      scheduledDepartureUnix:
        earliest.serviceDay + (earliest.scheduledDeparture ?? 0),
      delaySec: earliest.departureDelay,
      realtime: earliest.realtime,
      headwayMin,
    };
  } catch {
    return empty;
  }
}

function averageHeadwayMin(
  deps: { realtimeDeparture: number }[],
): number | null {
  if (deps.length < 3) return null;
  const slice = deps.slice(0, 4);
  const gapsSec: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    gapsSec.push(slice[i]!.realtimeDeparture - slice[i - 1]!.realtimeDeparture);
  }
  const avgSec = gapsSec.reduce((s, g) => s + g, 0) / gapsSec.length;
  if (avgSec <= 0) return null;
  return Math.round(avgSec / 60);
}

/**
 * Region label derived from an agency gtfsId prefix. Agency *names* drift
 * ("HSL" vs "Helsingin seudun liikenne -kuntayhtymä"), but the gtfsId
 * prefix is the stable key Digitransit guarantees. Returns `null` when no
 * prefix matches — Finland-wide long-distance / ELY rural feeds land here
 * and the LineView fineprint omits the region segment.
 *
 * Region labels are Finnish-facing on purpose: the line view's fineprint
 * is rendered alongside the operator name and the LINE id, all of which
 * are already locale-blind text from the upstream feed.
 */
export function regionFromAgencyId(agencyGtfsId: string): string | null {
  const prefix = agencyGtfsId.split(":")[0] ?? "";
  if ((HSL_PREFIXES as readonly string[]).includes(prefix)) {
    return "Helsingin seutu";
  }
  if ((WALTTI_PREFIXES as readonly string[]).includes(prefix)) {
    return WALTTI_REGION_LABEL[prefix] ?? "Waltti-seutu";
  }
  if ((VARELY_PREFIXES as readonly string[]).includes(prefix)) {
    return "ELY-alue";
  }
  return null;
}

const WALTTI_REGION_LABEL: Record<string, string> = {
  tampere: "Tampereen seutu",
  OULU: "Oulun seutu",
  Lahti: "Lahden seutu",
  Kuopio: "Kuopion seutu",
  Joensuu: "Joensuun seutu",
  Lappeenranta: "Lappeenrannan seutu",
  Vaasa: "Vaasan seutu",
  Pori: "Porin seutu",
  Kotka: "Kotkan seutu",
  Kouvola: "Kouvolan seutu",
  Mikkeli: "Mikkelin seutu",
  Hameenlinna: "Hämeenlinnan seutu",
  Rovaniemi: "Rovaniemen seutu",
  Salo: "Salon seutu",
  Kajaani: "Kajaanin seutu",
  LINKKI: "Jyväskylän seutu",
  Raasepori: "Raaseporin seutu",
  FOLI: "Turun seutu",
  FUNI: "Funicular",
};

/**
 * Line metadata + both directional patterns + per-pattern stop sequences in
 * a single upstream call. Driven by the gtfsId prefix via adapterRouter —
 * unknown prefixes fall back to the Finland adapter, so a feed we don't yet
 * recognise still resolves rather than 503-ing the page.
 *
 * Empty `patterns` surfaces as a `LineView` with `patterns: []` (not a 404)
 * — the empty-pattern plate on LineView wants a real LineView shape so the
 * masthead can still render with the available metadata.
 */
export async function getLine(
  gtfsId: string,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: LineView; cached: boolean }> {
  const key = cacheKey("transit", "line", 1, gtfsId);
  const cached = await tryCache(() => cacheGet<LineView>(key));
  if (cached) return { data: cached, cached: true };

  const adapter = adapterRouter.forStopId(gtfsId);
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx = makeContext(persona);

  const raw = await routeWithPatternsOperation(
    client,
    { routeId: gtfsId },
    ctx,
  );
  if (!raw) throw new NotFoundError("Line not found");

  // Coerce optional `Line.agency?:` to LineView.agency's required-or-null
  // contract — don't spread the raw shape, the optionality is a foot-gun on
  // consumers that branch on `agency === null`.
  const agency = raw.agency ?? null;
  const region = agency ? regionFromAgencyId(agency.gtfsId) : null;

  const patterns: Pattern[] = raw.patterns.map((p) => ({
    code: p.code,
    headsign: p.headsign,
    directionId: p.directionId,
    stops: p.stops.map((s) => ({
      gtfsId: s.gtfsId,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      code: s.code,
      platformCode: s.platformCode,
    })),
  }));

  const data: LineView = {
    gtfsId: raw.gtfsId,
    shortName: raw.shortName,
    longName: raw.longName,
    mode: raw.mode,
    color: raw.color,
    textColor: raw.textColor,
    agency,
    region,
    patterns,
  };

  await tryCache(() => cacheSet(key, data, LINE_TTL));
  return { data, cached: false };
}
