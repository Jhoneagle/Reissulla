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
import { routeLineDeparturesOperation } from "../../adapters/digitransit-routing/operations/routeLineDepartures.js";
import type {
  RawRouteLineDeparturesRoute,
  RawRouteLineStoptime,
} from "../../adapters/digitransit-routing/types.js";
import {
  HSL_PREFIXES,
  VARELY_PREFIXES,
  WALTTI_PREFIXES,
} from "../../adapters/digitransit-routing/dispatch.js";
import type { AdapterContext } from "../../adapters/types.js";
import { NotFoundError } from "../../utils/error-envelope.js";
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

/** Max stoptimes per pattern returned per stop. Three is enough to derive
 *  a headway average (two gaps) while keeping the payload bounded. */
const LINE_DEPARTURES_PER_STOP = 3;

function pickPattern(
  patterns: Pattern[],
  directionId: DirectionId | undefined,
): Pattern | undefined {
  if (patterns.length === 0) return undefined;
  if (directionId === undefined) return patterns[0];
  return patterns.find((p) => p.directionId === directionId) ?? patterns[0];
}

function pickRawPattern(
  rawRoute: RawRouteLineDeparturesRoute,
  patternCode: string,
) {
  return rawRoute.patterns.find((p) => p.code === patternCode);
}

/**
 * Per-stop "next departure for this line" projection. One upstream GraphQL
 * round-trip via `routeLineDeparturesOperation` returns each pattern stop's
 * next-departures already filtered to this route's patterns, so the LineView
 * stop spine reliably hydrates even when off-peak headways would have
 * pushed the next departure outside a 20-departure per-stop window (the
 * failure mode of the previous fan-out). Cached by `(gtfsId, direction)`
 * for 60 s — realtime moves but the *next-from-now* slot doesn't churn
 * fast enough to justify shorter TTLs.
 */
export async function getLineDepartures(
  gtfsId: string,
  directionId: DirectionId | undefined,
  persona: Persona = DEFAULT_PERSONA,
): Promise<{ data: LineStopDeparture[]; cached: boolean }> {
  const key = cacheKey(
    "transit",
    "line-departures",
    2,
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

  const adapter = adapterRouter.forStopId(gtfsId);
  const client = createGraphQLClient(adapter.name, adapter.graphUrl);
  const ctx = makeContext(persona);
  const startTime = Math.floor(Date.now() / 1000);

  let rawRoute: RawRouteLineDeparturesRoute | null = null;
  try {
    rawRoute = await routeLineDeparturesOperation(
      client,
      {
        routeId: gtfsId,
        startTime,
        numberOfDepartures: LINE_DEPARTURES_PER_STOP,
      },
      ctx,
    );
  } catch {
    // Upstream hiccup — return per-stop nulls so the page still renders
    // the stop spine; caching the empty projection would mask a transient.
    return {
      data: pattern.stops.map((stop) => emptyDeparture(stop)),
      cached: false,
    };
  }

  if (!rawRoute) {
    return {
      data: pattern.stops.map((stop) => emptyDeparture(stop)),
      cached: false,
    };
  }

  const rawPattern = pickRawPattern(rawRoute, pattern.code);
  const stoptimesByStop = new Map<string, RawRouteLineStoptime[]>();
  if (rawPattern) {
    for (const stop of rawPattern.stops) {
      const onPattern = stop.stoptimesForPatterns.find(
        (g) => g.pattern?.code === pattern.code,
      );
      // Sort ascending by absolute departure time so [0] is reliably the
      // next upcoming run. OTP's `stoptimesForPatterns` returns stoptimes
      // in pattern order, not chronological — the first entry can be a
      // later run if the upstream interleaves alternate trips.
      const sorted = [...(onPattern?.stoptimes ?? [])].sort(
        (a, b) =>
          a.serviceDay +
          a.realtimeDeparture -
          (b.serviceDay + b.realtimeDeparture),
      );
      stoptimesByStop.set(stop.gtfsId, sorted);
    }
  }

  const data = pattern.stops.map((stop) => {
    const stoptimes = stoptimesByStop.get(stop.gtfsId) ?? [];
    if (stoptimes.length === 0) return emptyDeparture(stop);
    const earliest = stoptimes[0]!;
    return {
      stop,
      nextDepartureUnix: earliest.serviceDay + earliest.realtimeDeparture,
      scheduledDepartureUnix: earliest.serviceDay + earliest.scheduledDeparture,
      delaySec: earliest.departureDelay,
      realtime: earliest.realtime,
      headwayMin: averageHeadwayMin(stoptimes),
    } satisfies LineStopDeparture;
  });

  await tryCache(() => cacheSet(key, data, LINE_DEPARTURES_TTL));
  return { data, cached: false };
}

function emptyDeparture(stop: PatternStop): LineStopDeparture {
  return {
    stop,
    nextDepartureUnix: null,
    scheduledDepartureUnix: null,
    delaySec: 0,
    realtime: false,
    headwayMin: null,
  };
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
