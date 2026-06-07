import type { TransitDeparture } from "@reissulla/shared";

/**
 * Stable per-trip identity for diffing one poll against the next. `tripId`
 * is the GTFS trip — distinct per direction and per service day — and
 * `serviceDay` separates the same trip across midnight. Rows that lack
 * tripId (legacy or feeds with missing data) get a fallback composite so
 * a missing field doesn't make every poll look "new".
 */
function keyOf(d: TransitDeparture): string {
  if (d.tripId) return `${d.tripId}@${d.serviceDay}`;
  return `${d.routeShortName}|${d.headsign}|${d.serviceDay}|${d.scheduledDeparture}`;
}

/**
 * Returns the subset of `next` that differs from `prev` — rows whose
 * `realtime`, `arrivalDelay`, or `departureDelay` changed (the three
 * realtime-only fields), plus any row in `next` whose key wasn't in
 * `prev`. The channel's publish gate uses `result.length > 0` to decide
 * whether to emit at all; the full `next` array is what actually goes
 * over the wire, so removed trips disappear from the FE naturally on
 * the next emit.
 *
 * `prev === null` (first poll after subscribe) returns `next` so the
 * very first publish carries the snapshot.
 */
export function diffDepartures(
  prev: TransitDeparture[] | null,
  next: TransitDeparture[],
): TransitDeparture[] {
  if (prev === null) return next;
  const prevByKey = new Map(prev.map((d) => [keyOf(d), d] as const));
  return next.filter((row) => {
    const old = prevByKey.get(keyOf(row));
    if (!old) return true;
    return (
      old.realtime !== row.realtime ||
      old.arrivalDelay !== row.arrivalDelay ||
      old.departureDelay !== row.departureDelay
    );
  });
}
