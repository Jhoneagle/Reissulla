import { XMLParser } from "fast-xml-parser";
import type { AdapterLocale } from "../types.js";
import type {
  FmiWarning,
  FmiWarningSeverity,
  FmiWarningType,
  GeoJsonPolygon,
} from "./types.js";

/**
 * FMI WFS warnings parser. Walks the gml/wfs tree pragmatically — FMI's
 * field naming has shifted across versions, so this code reads the small
 * subset we actually need (id, severity, type, time range, region,
 * description, optional polygon) and ignores everything else.
 *
 * Returns `[]` on parse failure rather than throwing. TODO: pipe the
 * caught error into the structured-logging hook once Phase 3 chunk 8
 * lands it — for now the silent fallback keeps the snapshot fan-out
 * resilient when FMI ships a backwards-incompatible XML shape.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

const SEVERITY_MAP: Record<string, FmiWarningSeverity> = {
  minor: "minor",
  moderate: "moderate",
  severe: "severe",
  extreme: "extreme",
};

const TYPE_KEYWORDS: Array<{
  type: FmiWarningType;
  patterns: readonly string[];
}> = [
  { type: "thunder", patterns: ["thunder", "ukkos", "salama"] },
  { type: "snow", patterns: ["snow", "lumi", "lumisade"] },
  { type: "ice", patterns: ["ice", "icing", "frost", "jää", "liukk"] },
  { type: "rain", patterns: ["rain", "shower", "precipitation", "sade"] },
  { type: "wind", patterns: ["wind", "gust", "storm", "tuul", "myrsky"] },
  { type: "fog", patterns: ["fog", "sumu"] },
  { type: "cold", patterns: ["cold", "low temperature", "pakkanen", "kylm"] },
  { type: "heat", patterns: ["heat", "hot", "helle", "kuum"] },
];

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (isObject(value)) {
    const inner = (value as { "#text"?: unknown })["#text"];
    if (typeof inner === "string") return inner;
    if (typeof inner === "number") return String(inner);
  }
  return undefined;
}

function mapSeverity(raw: string | undefined): FmiWarningSeverity {
  if (raw === undefined) return "moderate";
  const key = raw.trim().toLowerCase();
  // Unknown severity falls back to "moderate" — chosen so we surface the
  // warning to the user (rather than dropping it silently as "minor") while
  // not over-claiming an extreme event. Tighten once the FMI vocabulary is
  // pinned down in Chunk 5.
  return SEVERITY_MAP[key] ?? "moderate";
}

function mapType(...candidates: Array<string | undefined>): FmiWarningType {
  const haystack = candidates
    .filter((s): s is string => typeof s === "string")
    .join(" ")
    .toLowerCase();
  for (const entry of TYPE_KEYWORDS) {
    if (entry.patterns.some((p) => haystack.includes(p))) {
      return entry.type;
    }
  }
  // Unknown type falls back to "wind" — the most common Finnish warning
  // category, so the snapshot keeps a sensible default icon when FMI ships
  // a previously-unseen category code.
  return "wind";
}

function toUnixSeconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1000);
}

function parsePolygon(node: unknown): GeoJsonPolygon | undefined {
  if (!isObject(node)) return undefined;
  // Try a few common GML polygon paths. FMI uses gml:Polygon →
  // gml:exterior → gml:LinearRing → gml:posList (space-separated lat/lon).
  const polygon = (node as { Polygon?: unknown }).Polygon ?? node;
  if (!isObject(polygon)) return undefined;
  const exterior = (polygon as { exterior?: unknown }).exterior;
  if (!isObject(exterior)) return undefined;
  const ring = (exterior as { LinearRing?: unknown }).LinearRing;
  if (!isObject(ring)) return undefined;
  const posListRaw = readText((ring as { posList?: unknown }).posList);
  if (posListRaw === undefined) return undefined;

  const tokens = posListRaw
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  if (tokens.length < 8 || tokens.length % 2 !== 0) return undefined;

  const coords: number[][] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const lat = tokens[i]!;
    const lon = tokens[i + 1]!;
    coords.push([lon, lat]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

function localizedDescription(
  candidates: unknown,
  locale: AdapterLocale,
): string | undefined {
  for (const entry of asArray(candidates)) {
    if (!isObject(entry)) {
      const text = readText(entry);
      if (text) return text;
      continue;
    }
    const lang =
      readText((entry as { "@_lang"?: unknown })["@_lang"]) ??
      readText((entry as { lang?: unknown }).lang);
    const text = readText(entry);
    if (lang !== undefined && lang.toLowerCase().startsWith(locale)) {
      return text;
    }
  }
  for (const entry of asArray(candidates)) {
    const text = readText(entry);
    if (text) return text;
  }
  return undefined;
}

function extractWarningFields(
  member: unknown,
  locale: AdapterLocale,
): FmiWarning | undefined {
  if (!isObject(member)) return undefined;
  const warning =
    (member as { Warning?: unknown }).Warning ??
    (member as { warning?: unknown }).warning ??
    member;
  if (!isObject(warning)) return undefined;

  const id =
    readText((warning as { "@_id"?: unknown })["@_id"]) ??
    readText((warning as { id?: unknown }).id);
  if (id === undefined) return undefined;

  const severityRaw =
    readText((warning as { severity?: unknown }).severity) ??
    readText((warning as { "@_severity"?: unknown })["@_severity"]);
  const typeRaw =
    readText((warning as { type?: unknown }).type) ??
    readText((warning as { category?: unknown }).category) ??
    readText((warning as { "@_type"?: unknown })["@_type"]);
  const region =
    readText((warning as { region?: unknown }).region) ??
    readText((warning as { area?: unknown }).area) ??
    "";

  const description = localizedDescription(
    (warning as { description?: unknown }).description ??
      (warning as { descriptions?: unknown }).descriptions,
    locale,
  );

  const timeRange = (warning as { timeRange?: unknown }).timeRange;
  let startRaw: string | undefined;
  let endRaw: string | undefined;
  if (isObject(timeRange)) {
    startRaw =
      readText((timeRange as { startTime?: unknown }).startTime) ??
      readText((timeRange as { begin?: unknown }).begin);
    endRaw =
      readText((timeRange as { endTime?: unknown }).endTime) ??
      readText((timeRange as { end?: unknown }).end);
  }
  startRaw ??= readText((warning as { startTime?: unknown }).startTime);
  endRaw ??= readText((warning as { endTime?: unknown }).endTime);

  const startTime = toUnixSeconds(startRaw);
  const endTime = toUnixSeconds(endRaw);
  if (startTime === undefined || endTime === undefined) return undefined;

  const bounds = parsePolygon(
    (warning as { bounds?: unknown }).bounds ??
      (warning as { geometry?: unknown }).geometry,
  );

  return {
    id,
    severity: mapSeverity(severityRaw),
    type: mapType(typeRaw, description, region),
    startTime,
    endTime,
    region,
    description: description ?? "",
    ...(bounds !== undefined ? { bounds } : {}),
  };
}

export function parseFmiWarnings(
  xml: string,
  locale: AdapterLocale,
): FmiWarning[] {
  let tree: unknown;
  try {
    tree = parser.parse(xml);
  } catch {
    // TODO: emit a structured-logging hook (Phase 3 Chunk 8). Returning
    // an empty list keeps the snapshot fan-out resilient when FMI ships
    // a backwards-incompatible XML shape.
    return [];
  }

  if (!isObject(tree)) return [];

  const collection =
    (tree as { FeatureCollection?: unknown }).FeatureCollection ?? tree;
  if (!isObject(collection)) return [];

  const members = asArray(
    (collection as { member?: unknown }).member ??
      (collection as { featureMember?: unknown }).featureMember,
  );

  const warnings: FmiWarning[] = [];
  for (const member of members) {
    const w = extractWarningFields(member, locale);
    if (w !== undefined) warnings.push(w);
  }
  return warnings;
}
