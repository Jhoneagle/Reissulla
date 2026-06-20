import type { Alert } from "@reissulla/shared";
import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import { ALERTS_ACTIVE_TTL } from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import type { AdapterContext } from "../../adapters/types.js";
import { createGraphQLClient } from "../../adapters/digitransit-routing/client.js";
import { alertsOperation } from "../../adapters/digitransit-routing/operations/alerts.js";
import { adapterRouter } from "../transit/adapter-router.js";
import { getWarningPolygons } from "../weather/warning-polygons.service.js";
import { digitransitToAlerts, fmiWarningsToAlerts } from "./normalise.js";

/**
 * Alerts composer. Folds Digitransit `alerts(...)`, FMI weather warnings, and
 * (slot only for now) Fintraffic incidents into the unified `Alert[]`.
 *
 * The composed set is cached once, view-state-free, under
 * `alerts:active:v1:all`. Every consumer — the REST endpoint, each SSE
 * subscriber's poller — reads that one slot and filters at the edge, so upstream
 * is hit at most once per `ALERTS_ACTIVE_TTL` no matter how many clients are
 * connected (the cache-source-filter-at-edge principle the rest of the API
 * follows).
 *
 * Per-user filtering by pinned stops/lines happens on the FE, which already
 * holds the pin set; the optional `getActive` filter supports direct API use.
 */

export interface AlertFilter {
  routes?: string[];
  stops?: string[];
  regions?: string[];
}

function makeContext(): AdapterContext {
  // Locale is irrelevant here — the alerts query requests fi + en text
  // explicitly, so the composed `Alert` is always bilingual.
  return { signal: new AbortController().signal, locale: "fi" };
}

async function fetchDigitransitAlerts(ctx: AdapterContext): Promise<Alert[]> {
  const adapters = adapterRouter.all().filter((adapter) => adapter.enabled());
  const perAdapter = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const client = createGraphQLClient(adapter.name, adapter.graphUrl);
        const raws = await alertsOperation(client, ctx);
        return raws.flatMap(digitransitToAlerts);
      } catch {
        // One feed being down shouldn't blank the whole alert set — the other
        // feeds (and FMI) still compose.
        return [] as Alert[];
      }
    }),
  );
  return perAdapter.flat();
}

async function fetchFmiAlerts(): Promise<Alert[]> {
  try {
    const [fi, en] = await Promise.all([
      getWarningPolygons({ locale: "fi" }),
      getWarningPolygons({ locale: "en" }),
    ]);
    return fmiWarningsToAlerts(fi.data, en.data);
  } catch {
    return [];
  }
}

function fetchFintrafficAlerts(): Alert[] {
  // Source slot. The Fintraffic adapter today only exposes road-surface
  // conditions; the incident/traffic-message feed wires in a follow-up. The
  // composer keeps the slot so adding it later is a one-line change here.
  return [];
}

function dedupeById(alerts: Alert[]): Alert[] {
  const byId = new Map<string, Alert>();
  for (const alert of alerts) {
    if (!byId.has(alert.id)) byId.set(alert.id, alert);
  }
  return Array.from(byId.values());
}

export async function composeActiveAlerts(): Promise<Alert[]> {
  const ctx = makeContext();
  const [digitransit, fmi] = await Promise.all([
    fetchDigitransitAlerts(ctx),
    fetchFmiAlerts(),
  ]);
  // Multiple region graphs can report the same alert; the content-hash id makes
  // those collapse cleanly.
  return dedupeById([...digitransit, ...fmi, ...fetchFintrafficAlerts()]);
}

function applyFilter(alerts: Alert[], filter: AlertFilter): Alert[] {
  const routes = filter.routes && new Set(filter.routes);
  const stops = filter.stops && new Set(filter.stops);
  const regions = filter.regions && new Set(filter.regions);
  if (!routes && !stops && !regions) return alerts;
  return alerts.filter((alert) => {
    switch (alert.scope.kind) {
      case "route":
        return routes?.has(alert.scope.gtfsId) ?? false;
      case "stop":
        return stops?.has(alert.scope.gtfsId) ?? false;
      case "region":
        return regions?.has(alert.scope.code) ?? false;
      case "global":
        // Network-wide notices stay relevant whatever the user pinned.
        return true;
    }
  });
}

export async function getActive(
  filter?: AlertFilter,
): Promise<{ data: Alert[]; cached: boolean }> {
  const key = cacheKey("alerts", "active", 1, "all");
  let set = await tryCache(() => cacheGet<Alert[]>(key));
  let cached = true;
  if (set === null) {
    set = await composeActiveAlerts();
    await tryCache(() => cacheSet(key, set, ALERTS_ACTIVE_TTL));
    cached = false;
  }
  const data = filter ? applyFilter(set, filter) : set;
  return { data, cached };
}
