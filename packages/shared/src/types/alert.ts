/**
 * Unified service-alert shape. The API's `alerts.service` composes three
 * upstreams into this one contract:
 *   - Digitransit `alerts(...)` (transit delays / cancellations / detours)
 *   - FMI weather warnings (already shipped via warning-polygons.service)
 *   - Fintraffic incidents (source slot wired; real fetch lands later)
 *
 * Mirrors `docs/technical-plan.md` §6.3. Two deliberate deltas from that
 * sketch:
 *   - `startTime` / `endTime` are Unix **ms** (matches `WeatherWarning`), not
 *     the seconds Digitransit emits — the API converts at the edge so the FE
 *     never juggles two time units.
 *   - a concise `headline` is split out from the full `description`. Digitransit
 *     carries both a header and a body; the banner / inline chip show the
 *     headline and reveal the description on expand. Both are bilingual so the
 *     FE resolves locale without a round-trip.
 */

export type AlertSource = "digitransit" | "fmi" | "fintraffic";

/** Normalised three-level severity. Digitransit `UNKNOWN_SEVERITY` → warning. */
export type AlertSeverity = "info" | "warning" | "severe";

export type AlertCause =
  | "NONE"
  | "TECHNICAL"
  | "STRIKE"
  | "DEMONSTRATION"
  | "ACCIDENT"
  | "HOLIDAY"
  | "WEATHER"
  | "MAINTENANCE"
  | "CONSTRUCTION"
  | "POLICE_ACTIVITY"
  | "MEDICAL_EMERGENCY"
  | "OTHER";

export type AlertEffect =
  | "NO_SERVICE"
  | "REDUCED_SERVICE"
  | "SIGNIFICANT_DELAYS"
  | "DETOUR"
  | "ADDITIONAL_SERVICE"
  | "MODIFIED_SERVICE"
  | "STOP_MOVED"
  | "OTHER";

/**
 * What the alert applies to. A transit alert affecting several routes is
 * exploded into one `Alert` per route so per-pin filtering stays a simple
 * scope match; an alert with no affected entity is `global`.
 */
export type AlertScope =
  | { kind: "route"; gtfsId: string }
  | { kind: "stop"; gtfsId: string }
  | { kind: "region"; code: string }
  | { kind: "global" };

export interface AlertText {
  fi: string;
  en: string;
}

export interface Alert {
  /** Content hash — stable across polls for the same upstream alert + scope. */
  id: string;
  source: AlertSource;
  severity: AlertSeverity;
  cause: AlertCause;
  effect: AlertEffect | null;
  /** Unix ms. */
  startTime: number;
  /** Unix ms, or null for open-ended alerts. */
  endTime: number | null;
  scope: AlertScope;
  /** Concise summary line. May be empty for weather warnings. */
  headline: AlertText;
  /** Full body text. */
  description: AlertText;
}

/**
 * Safety-of-life subset that warrants `aria-live="assertive"` (preempts the
 * screen reader). Everything else announces politely. Kept here so the FE
 * banner and any future surface share one definition.
 */
export function isAssertiveAlert(alert: Alert): boolean {
  return (
    alert.effect === "NO_SERVICE" &&
    (alert.cause === "ACCIDENT" ||
      alert.cause === "MEDICAL_EMERGENCY" ||
      alert.cause === "POLICE_ACTIVITY")
  );
}
