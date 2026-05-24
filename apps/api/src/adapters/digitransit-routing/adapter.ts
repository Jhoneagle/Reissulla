import type { AdapterContext } from "../types.js";
import type {
  PlanConnectionArgs,
  RawNearestEdge,
  RawPlanConnectionData,
  RawSearchStopsAndStationsData,
  RawStationDeparturesData,
  RawStopDeparturesData,
} from "./types.js";

export type DigitransitAdapterName =
  | "digitransit-finland"
  | "digitransit-hsl"
  | "digitransit-waltti"
  | "digitransit-varely";

export interface DigitransitAdapter {
  readonly name: DigitransitAdapterName;
  readonly graphUrl: string;
  enabled(): boolean;
  nearest(
    lat: number,
    lon: number,
    radius: number,
    ctx: AdapterContext,
  ): Promise<RawNearestEdge[]>;
  searchStopsAndStations(
    name: string,
    ctx: AdapterContext,
  ): Promise<RawSearchStopsAndStationsData>;
  stopDepartures(
    stopId: string,
    n: number,
    ctx: AdapterContext,
  ): Promise<RawStopDeparturesData>;
  stationDepartures(
    stationId: string,
    n: number,
    ctx: AdapterContext,
  ): Promise<RawStationDeparturesData>;
  planConnection(
    args: PlanConnectionArgs,
    ctx: AdapterContext,
  ): Promise<RawPlanConnectionData>;
}
