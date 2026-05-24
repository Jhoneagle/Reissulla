import type { AdapterContext } from "../types.js";
import type {
  PlanConnectionArgs,
  RawNearestEdge,
  RawPlanConnectionData,
  RawSearchStopsAndStationsData,
  RawStationDeparturesData,
  RawStopDeparturesData,
} from "./types.js";
import type { StationDeparturesArgs } from "./operations/stationDepartures.js";
import type { StopDeparturesArgs } from "./operations/stopDepartures.js";

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
    args: StopDeparturesArgs,
    ctx: AdapterContext,
  ): Promise<RawStopDeparturesData>;
  stationDepartures(
    args: StationDeparturesArgs,
    ctx: AdapterContext,
  ): Promise<RawStationDeparturesData>;
  planConnection(
    args: PlanConnectionArgs,
    ctx: AdapterContext,
  ): Promise<RawPlanConnectionData>;
}
