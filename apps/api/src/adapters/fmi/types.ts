export type FmiWarningSeverity = "minor" | "moderate" | "severe" | "extreme";

export type FmiWarningType =
  | "wind"
  | "rain"
  | "snow"
  | "ice"
  | "cold"
  | "heat"
  | "thunder"
  | "fog";

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface FmiWarning {
  id: string;
  severity: FmiWarningSeverity;
  type: FmiWarningType;
  /** Unix milliseconds — matches JS Date.now() so the FE banner can compare directly. */
  startTime: number;
  /** Unix milliseconds. Banner dismissal honours this for the per-warning suppression rule. */
  endTime: number;
  region: string;
  description: string;
  bounds?: GeoJsonPolygon;
}

export interface RadarFrame {
  timestamp: number;
  tileUrlTemplate: string;
}
