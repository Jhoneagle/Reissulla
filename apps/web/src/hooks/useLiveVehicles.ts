import type { LineVehiclesEvent, VehiclePosition } from "@reissulla/shared";
import { useFeatureFlags } from "./useFeatureFlags";
import type { LiveIndicatorState } from "./useLiveDepartures";
import { useSseSubscription, type SseStatus } from "../lib/sse";

export interface UseLiveVehiclesResult {
  /** Current set of vehicles running the line (empty before first event). */
  vehicles: VehiclePosition[];
  /** True while the server is serving the polled GraphQL fallback. */
  degraded: boolean;
  /** What the `<LiveIndicator>` pill should render. */
  indicator: LiveIndicatorState;
  /** Raw SSE status for diagnostics. */
  sseStatus: SseStatus;
  /** Whether the live stream was attempted (feature flag on + a line id). */
  enabled: boolean;
  /** Wall-clock ms of the most recent snapshot, or null before the first. */
  lastUpdate: number | null;
}

/**
 * Live vehicle positions for one line over
 * `GET /api/v1/transit/lines/:gtfsId/live`. Unlike departures there is no
 * REST polling fallback on the client — the server transparently degrades
 * MQTT to a polled GraphQL query and stamps `freshness.degraded`, so the
 * FE just consumes the SSE snapshot and surfaces the degraded flag.
 *
 * Returns the full vehicle set on every event (the channel publishes a
 * snapshot, not a delta), so the map dots and the SR list render from one
 * source and stay in lockstep.
 */
export function useLiveVehicles(gtfsId: string | null): UseLiveVehiclesResult {
  const flags = useFeatureFlags();
  const enabled = flags.feature.realtimeSse && gtfsId !== null;
  const path = enabled
    ? `/api/v1/transit/lines/${encodeURIComponent(gtfsId)}/live`
    : null;

  const sse = useSseSubscription<LineVehiclesEvent>(path);

  const vehicles = sse.data?.vehicles ?? [];
  const degraded = sse.data?.freshness.degraded ?? false;

  const indicator: LiveIndicatorState = !enabled
    ? "polling"
    : sse.status === "open" && sse.data !== null
      ? "live"
      : sse.status === "error"
        ? "error"
        : "polling";

  return {
    vehicles,
    degraded,
    indicator,
    sseStatus: sse.status,
    enabled,
    lastUpdate: sse.lastUpdate,
  };
}
