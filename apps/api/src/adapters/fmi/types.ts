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
  startTime: number;
  endTime: number;
  region: string;
  description: string;
  bounds?: GeoJsonPolygon;
}

export interface RadarFrame {
  timestamp: number;
  tileUrlTemplate: string;
}
