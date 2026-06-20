import { connect, type IClientOptions, type MqttClient } from "mqtt";
import type { VehiclePosition } from "@reissulla/shared";
import { config } from "../../config.js";
import { tryCache } from "../../utils/resilience.js";
import { createGraphQLClient } from "../digitransit-routing/client.js";
import { vehiclePositionsOperation } from "../digitransit-routing/operations/vehiclePositions.js";
import { buildVehicleTopic, decodeHfp } from "./client.js";
import type { VehicleFilter, VehicleStreamStatus } from "./types.js";

/**
 * Digitransit MQTT adapter contract. Chunk 3 implements the real WSS
 * connection (`wss://mqtt.hsl.fi:443/`) + HFP decode, with a polled
 * `vehiclePositions` GraphQL fallback when the broker is unreachable.
 */
export interface DigitransitMqttAdapter {
  /**
   * Subscribe to vehicle pings matching `filter`. `onStatus` reports the
   * degraded/healthy transition so the channel can stamp
   * `freshness.degraded` on its payload. The returned function is the
   * unsubscribe handle — the registry calls it when the last SSE
   * connection on the line channel disconnects.
   */
  subscribeVehicles(
    filter: VehicleFilter,
    onMessage: (v: VehiclePosition) => void,
    onStatus?: (status: VehicleStreamStatus) => void,
  ): () => void;
}

type ConnectFn = (url: string, opts: IClientOptions) => MqttClient;
type FallbackFn = (
  routeId: string,
  signal: AbortSignal,
) => Promise<VehiclePosition[]>;

/** Injectable seams so tests drive the adapter without a broker or network. */
export interface MqttAdapterDeps {
  connect?: ConnectFn;
  pollFallback?: FallbackFn;
}

const HSL_GRAPH_URL = "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1";
const fallbackClient = createGraphQLClient("digitransit-mqtt", HSL_GRAPH_URL);

const defaultPollFallback: FallbackFn = async (routeId, signal) => {
  const vehicles = await tryCache(() =>
    vehiclePositionsOperation(fallbackClient, routeId, {
      signal,
      locale: "fi",
    }),
  );
  return vehicles ?? [];
};

export function createDigitransitMqttAdapter(
  deps: MqttAdapterDeps = {},
): DigitransitMqttAdapter {
  const connectFn = deps.connect ?? connect;
  const pollFallback = deps.pollFallback ?? defaultPollFallback;

  return {
    subscribeVehicles(filter, onMessage, onStatus) {
      const routeId = filter.route;
      let closed = false;
      let degraded = false;

      const setDegraded = (next: boolean): void => {
        if (next === degraded) return;
        degraded = next;
        onStatus?.({ degraded: next });
      };

      const fallbackController = new AbortController();
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

      const runFallback = async (): Promise<void> => {
        if (closed || routeId === undefined) return;
        const vehicles = await pollFallback(routeId, fallbackController.signal);
        if (closed) return;
        for (const v of vehicles) onMessage(v);
        fallbackTimer = setTimeout(() => {
          void runFallback();
        }, config.realtimeVehicleFallbackPollMs);
      };

      const startFallback = (): void => {
        if (fallbackTimer !== null || closed || routeId === undefined) return;
        setDegraded(true);
        void runFallback();
      };

      const stopFallback = (): void => {
        if (fallbackTimer !== null) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };

      // No broker configured (dev default) or no route to filter on: there
      // is no live source, so serve the polled fallback from the start.
      if (!config.mqttBrokerUrl || routeId === undefined) {
        startFallback();
        return () => {
          closed = true;
          stopFallback();
          fallbackController.abort();
        };
      }

      const client = connectFn(config.mqttBrokerUrl, {
        username: config.mqttUsername || undefined,
        password: config.mqttPassword || undefined,
        reconnectPeriod: 5000,
      });
      const topic = buildVehicleTopic(routeId);

      let unreachableTimer: ReturnType<typeof setTimeout> | null = setTimeout(
        startFallback,
        config.mqttFallbackAfterMs,
      );
      const clearUnreachable = (): void => {
        if (unreachableTimer !== null) {
          clearTimeout(unreachableTimer);
          unreachableTimer = null;
        }
      };
      const armUnreachable = (): void => {
        if (unreachableTimer === null && fallbackTimer === null && !closed) {
          unreachableTimer = setTimeout(
            startFallback,
            config.mqttFallbackAfterMs,
          );
        }
      };

      client.on("connect", () => {
        clearUnreachable();
        stopFallback();
        setDegraded(false);
        client.subscribe(topic);
      });
      client.on("message", (_topic, payload) => {
        const vehicle = decodeHfp(payload, routeId);
        if (vehicle) onMessage(vehicle);
      });
      client.on("close", armUnreachable);
      client.on("offline", armUnreachable);
      client.on("error", armUnreachable);

      return () => {
        closed = true;
        clearUnreachable();
        stopFallback();
        fallbackController.abort();
        client.end(true);
      };
    },
  };
}

/**
 * Process-wide adapter instance — real `mqtt.connect` + GraphQL fallback.
 * The line-vehicles channel consumes this; tests build their own via
 * `createDigitransitMqttAdapter({ connect, pollFallback })`.
 */
export const digitransitMqtt: DigitransitMqttAdapter =
  createDigitransitMqttAdapter();

export type { VehiclePosition, VehicleFilter } from "./types.js";
