import type { VehiclePosition } from "@reissulla/shared";

/**
 * HSL HFP (high-frequency positioning) helpers — the pure decode + topic
 * pieces of the MQTT vehicle stream. The live connection orchestration
 * lives in `index.ts`; keeping these here makes the decode unit-testable
 * without a broker.
 *
 * Topic grammar (HFP v2):
 *   /hfp/v2/<journey>/<temporal>/<event>/<mode>/<operator>/<vehicle>/
 *   <route>/<dir>/<headsign>/<start>/<next_stop>/<geohash_lvl>/<geohash>/
 *
 * The `<route>` level is the JORE route id — the gtfsId without its feed
 * prefix ("HSL:1058" → "1058").
 */

/** Subscribe to vehicle-position (`vp`) events for one route, any vehicle. */
export function buildVehicleTopic(gtfsId: string): string {
  const route = gtfsId.includes(":")
    ? gtfsId.slice(gtfsId.indexOf(":") + 1)
    : gtfsId;
  return `/hfp/v2/journey/ongoing/vp/+/+/+/${route}/#`;
}

/** The `VP` envelope HSL publishes on each vehicle-position message. */
interface HfpVpEnvelope {
  VP?: HfpVp;
}

interface HfpVp {
  veh?: number;
  oper?: number;
  route?: string;
  /** HFP direction is 1-based ("1" / "2"); GTFS is 0-based. */
  dir?: string;
  lat?: number;
  long?: number;
  /** Heading in degrees, 0 = north. */
  hdg?: number;
  /** Speed in metres per second. */
  spd?: number;
  /** Seconds *ahead* of schedule (positive = early) — GTFS is the inverse. */
  dl?: number;
  /** Unix seconds timestamp. */
  tsi?: number;
  /** ISO-8601 timestamp; fallback when `tsi` is absent. */
  tst?: string;
}

/**
 * Decode one HFP `vp` payload into a `VehiclePosition`. Returns null for
 * non-`VP` events, malformed JSON, or pings missing coordinates / vehicle
 * id, so the channel never publishes a half-formed dot. `routeId` is the
 * subscribed gtfsId — HFP carries only the prefix-less JORE id, so we keep
 * the id the subscription was opened with.
 */
export function decodeHfp(
  raw: Buffer | string,
  routeId: string,
  now: number = Date.now(),
): VehiclePosition | null {
  let parsed: HfpVpEnvelope;
  try {
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    parsed = JSON.parse(text) as HfpVpEnvelope;
  } catch {
    return null;
  }
  const vp = parsed.VP;
  if (!vp) return null;
  if (typeof vp.lat !== "number" || typeof vp.long !== "number") return null;
  if (vp.veh == null) return null;

  const vehicleId = vp.oper != null ? `${vp.oper}/${vp.veh}` : String(vp.veh);
  const directionId =
    vp.dir != null && vp.dir !== "" && Number.isFinite(Number(vp.dir))
      ? String(Number(vp.dir) - 1)
      : undefined;

  let ts = now;
  if (typeof vp.tsi === "number") {
    ts = vp.tsi * 1000;
  } else if (vp.tst) {
    const parsedTs = Date.parse(vp.tst);
    if (!Number.isNaN(parsedTs)) ts = parsedTs;
  }

  return {
    vehicleId,
    routeId,
    directionId,
    lat: vp.lat,
    lon: vp.long,
    bearing: typeof vp.hdg === "number" ? vp.hdg : undefined,
    speed: typeof vp.spd === "number" ? vp.spd : undefined,
    delaySeconds: typeof vp.dl === "number" ? -vp.dl : null,
    ts,
  };
}
