/**
 * Normalises volatile fields out of upstream responses so refreshed
 * fixtures don't churn on every run.
 *
 * The default policy is conservative — only fields that genuinely change
 * run-to-run are touched, scheduled values are preserved. Recipes can
 * extend or override.
 */

export interface StripPolicy {
  /** Field names (any depth) to set to null. */
  additionalStrip?: string[];
  /** Field names from the default strip list to keep. */
  preserve?: string[];
}

const DEFAULT_STRIP_FIELDS = new Set([
  "realtimeArrival",
  "realtimeDeparture",
  "arrivalDelay",
  "departureDelay",
  "realtime",
  "realtimeState",
  "serviceDay",
]);

/** Top-level keys whose value should be replaced with `[]`. */
const DEFAULT_CLEAR_ARRAY_FIELDS = new Set(["alerts"]);

/** Vehicle-position fields nulled (positions move; schedules don't). */
const VEHICLE_POSITION_FIELDS = new Set(["lat", "lon", "heading", "speed"]);

export function stripVolatile(
  data: unknown,
  policy: StripPolicy = {},
): unknown {
  const stripSet = new Set(DEFAULT_STRIP_FIELDS);
  for (const f of policy.preserve ?? []) stripSet.delete(f);
  for (const f of policy.additionalStrip ?? []) stripSet.add(f);

  return walk(data, stripSet, false);
}

function walk(
  node: unknown,
  stripSet: Set<string>,
  insideVehiclePositions: boolean,
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, stripSet, insideVehiclePositions));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (stripSet.has(k)) {
        out[k] = null;
        continue;
      }
      if (DEFAULT_CLEAR_ARRAY_FIELDS.has(k)) {
        out[k] = [];
        continue;
      }
      if (insideVehiclePositions && VEHICLE_POSITION_FIELDS.has(k)) {
        out[k] = null;
        continue;
      }
      const childInsideVehicle =
        insideVehiclePositions || k === "vehiclePositions";
      out[k] = walk(v, stripSet, childInsideVehicle);
    }
    return out;
  }
  return node;
}
