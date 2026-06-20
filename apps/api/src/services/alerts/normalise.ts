import { createHash } from "node:crypto";
import type {
  Alert,
  AlertCause,
  AlertEffect,
  AlertScope,
  AlertSeverity,
  AlertSource,
  AlertText,
  WeatherWarning,
  WeatherWarningSeverity,
} from "@reissulla/shared";
import type {
  RawAlert,
  RawAlertEntity,
} from "../../adapters/digitransit-routing/types.js";

/**
 * Pure normalisers that fold each upstream alert source into the unified
 * `Alert` shape. Kept side-effect-free (the one exception is a `console.warn`
 * on an unrecognised severity, which the unit tests assert) so the composer
 * stays trivially testable.
 */

function scopeKey(scope: AlertScope): string {
  switch (scope.kind) {
    case "route":
      return `route:${scope.gtfsId}`;
    case "stop":
      return `stop:${scope.gtfsId}`;
    case "region":
      return `region:${scope.code}`;
    case "global":
      return "global";
  }
}

/**
 * Content hash → stable id across polls. The same upstream alert at the same
 * scope produces the same id even as the cache turns over, which is what the
 * notification-centre `alert_seen` join (a later chunk) needs.
 */
export function alertContentId(input: {
  source: AlertSource;
  scope: AlertScope;
  startTime: number;
  descriptionFi: string;
}): string {
  return createHash("sha1")
    .update(
      `${input.source}|${scopeKey(input.scope)}|${input.startTime}|${input.descriptionFi}`,
    )
    .digest("hex")
    .slice(0, 16);
}

function pickText(fi: string | null, en: string | null): AlertText {
  const f = (fi ?? "").trim();
  const e = (en ?? "").trim();
  // Fall back to the other language so a single-language upstream alert still
  // renders on both locales rather than showing a blank banner.
  return { fi: f || e, en: e || f };
}

export function mapDigitransitSeverity(level: string | null): AlertSeverity {
  switch (level) {
    case "INFO":
      return "info";
    case "WARNING":
      return "warning";
    case "SEVERE":
      return "severe";
    case "UNKNOWN_SEVERITY":
    case null:
    case "":
      return "warning";
    default:
      // A value upstream added that we don't model yet — surface it so the
      // mapping table can be extended, but don't drop the alert.
      console.warn(`alerts: unmapped Digitransit severity "${level}"`);
      return "warning";
  }
}

export function mapDigitransitCause(cause: string | null): AlertCause {
  switch (cause) {
    case "TECHNICAL_PROBLEM":
      return "TECHNICAL";
    case "STRIKE":
      return "STRIKE";
    case "DEMONSTRATION":
      return "DEMONSTRATION";
    case "ACCIDENT":
      return "ACCIDENT";
    case "HOLIDAY":
      return "HOLIDAY";
    case "WEATHER":
      return "WEATHER";
    case "MAINTENANCE":
      return "MAINTENANCE";
    case "CONSTRUCTION":
      return "CONSTRUCTION";
    case "POLICE_ACTIVITY":
      return "POLICE_ACTIVITY";
    case "MEDICAL_EMERGENCY":
      return "MEDICAL_EMERGENCY";
    case "UNKNOWN_CAUSE":
    case null:
      return "NONE";
    default:
      return "OTHER";
  }
}

export function mapDigitransitEffect(
  effect: string | null,
): AlertEffect | null {
  switch (effect) {
    case "NO_SERVICE":
      return "NO_SERVICE";
    case "REDUCED_SERVICE":
      return "REDUCED_SERVICE";
    case "SIGNIFICANT_DELAYS":
      return "SIGNIFICANT_DELAYS";
    case "DETOUR":
      return "DETOUR";
    case "ADDITIONAL_SERVICE":
      return "ADDITIONAL_SERVICE";
    case "MODIFIED_SERVICE":
      return "MODIFIED_SERVICE";
    case "STOP_MOVED":
      return "STOP_MOVED";
    case "OTHER_EFFECT":
    case "ACCESSIBILITY_ISSUE":
      return "OTHER";
    default:
      // NO_EFFECT / UNKNOWN_EFFECT / null → the alert carries no service impact.
      return null;
  }
}

/**
 * Affected entities → one scope each. Routes and stops both feed per-pin
 * filtering, so an alert touching several is exploded into one `Alert` per
 * entity. An alert with no scoped entity is `global` (e.g. a network-wide
 * notice).
 */
function entitiesToScopes(entities: RawAlertEntity[] | null): AlertScope[] {
  const scopes: AlertScope[] = [];
  for (const entity of entities ?? []) {
    if (!entity.gtfsId) continue;
    if (entity.__typename === "Route") {
      scopes.push({ kind: "route", gtfsId: entity.gtfsId });
    } else if (entity.__typename === "Stop") {
      scopes.push({ kind: "stop", gtfsId: entity.gtfsId });
    }
  }
  return scopes.length > 0 ? scopes : [{ kind: "global" }];
}

export function digitransitToAlerts(raw: RawAlert): Alert[] {
  const severity = mapDigitransitSeverity(raw.alertSeverityLevel);
  const cause = mapDigitransitCause(raw.alertCause);
  const effect = mapDigitransitEffect(raw.alertEffect);
  const headline = pickText(raw.alertHeaderTextFi, raw.alertHeaderTextEn);
  let description = pickText(
    raw.alertDescriptionTextFi,
    raw.alertDescriptionTextEn,
  );
  // A banner needs body text; fall back to the headline when the description
  // is blank (some feeds publish header-only alerts).
  if (!description.fi && !description.en) description = headline;
  const startTime = (raw.effectiveStartDate ?? 0) * 1000;
  const endTime =
    raw.effectiveEndDate !== null ? raw.effectiveEndDate * 1000 : null;

  return entitiesToScopes(raw.entities).map((scope) => ({
    id: alertContentId({
      source: "digitransit",
      scope,
      startTime,
      descriptionFi: description.fi,
    }),
    source: "digitransit",
    severity,
    cause,
    effect,
    startTime,
    endTime,
    scope,
    headline,
    description,
  }));
}

export function mapWeatherWarningSeverity(
  severity: WeatherWarningSeverity,
): AlertSeverity {
  switch (severity) {
    case "minor":
      return "info";
    case "moderate":
      return "warning";
    case "severe":
    case "extreme":
      return "severe";
  }
}

/**
 * FMI warnings into the unified shape. `getWarningPolygons` resolves text per
 * locale, so the composer fetches both languages and this zips them by id to
 * fill the bilingual `description`. Weather warnings carry no separate headline
 * — the FE renders a severity + type label instead.
 */
export function fmiWarningsToAlerts(
  fi: WeatherWarning[],
  en: WeatherWarning[],
): Alert[] {
  const enById = new Map(en.map((w) => [w.id, w]));
  return fi.map((warning) => {
    const enWarning = enById.get(warning.id);
    const description: AlertText = {
      fi: warning.description,
      en: enWarning?.description ?? warning.description,
    };
    const scope: AlertScope = { kind: "region", code: warning.region };
    return {
      id: alertContentId({
        source: "fmi",
        scope,
        startTime: warning.startTime,
        descriptionFi: description.fi,
      }),
      source: "fmi",
      severity: mapWeatherWarningSeverity(warning.severity),
      cause: "WEATHER",
      effect: null,
      startTime: warning.startTime,
      endTime: warning.endTime,
      scope,
      headline: { fi: "", en: "" },
      description,
    };
  });
}
