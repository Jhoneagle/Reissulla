import type { FastifyPluginAsync } from "fastify";
import type { TransitSubStop } from "@reissulla/shared";
import {
  getNearbyStops,
  searchStops,
  getStopDepartures,
  getMultiStopDepartures,
  planRoute,
} from "../services/transit/index.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";
import { parseJson } from "../utils/json.js";

function isSubStopArray(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => typeof v === "object" && v !== null);
}

function coerceSubStop(raw: Record<string, unknown>): TransitSubStop {
  return {
    gtfsId: String(raw.gtfsId ?? ""),
    code: raw.code != null ? String(raw.code) : null,
    platformCode: raw.platformCode != null ? String(raw.platformCode) : null,
    vehicleMode: raw.vehicleMode != null ? String(raw.vehicleMode) : null,
  };
}

export const transitRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: { lat: string; lon: string; radius?: string } }>(
    "/api/v1/transit/stops",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["lat", "lon"],
          properties: {
            lat: { type: "string" },
            lon: { type: "string" },
            radius: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { lat, lon } = parseCoordinates(request.query);

      let radius = 500;
      if (request.query.radius) {
        const parsed = Number(request.query.radius);
        if (Number.isNaN(parsed) || parsed < 100 || parsed > 2000) {
          return badRequest("radius must be a number between 100 and 2000");
        }
        radius = parsed;
      }

      const { data, cached } = await getNearbyStops(lat, lon, radius);
      return { data, cached };
    },
  );

  server.get<{ Querystring: { q: string } }>(
    "/api/v1/transit/stops/search",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: { q: { type: "string" } },
        },
      },
    },
    async (request) => {
      const q = request.query.q.trim();
      if (q === "") {
        return badRequest("q must not be empty");
      }

      const { data, cached } = await searchStops(q);
      return { data, cached };
    },
  );

  server.get<{
    Querystring: { stopId: string; count?: string; isStation?: string };
  }>(
    "/api/v1/transit/departures",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["stopId"],
          properties: {
            stopId: { type: "string" },
            count: { type: "string" },
            isStation: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const stopId = request.query.stopId.trim();
      if (stopId === "") {
        return badRequest("stopId must not be empty");
      }

      let count = 20;
      if (request.query.count) {
        const parsed = Number(request.query.count);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
          return badRequest("count must be a number between 1 and 100");
        }
        count = parsed;
      }

      const isStation = request.query.isStation === "true";
      const { data, cached } = await getStopDepartures(stopId, count, isStation);
      return { data, cached };
    },
  );

  server.get<{
    Querystring: {
      stopIds: string;
      subStops?: string;
      stationId?: string;
      countPerStop?: string;
      totalCount?: string;
    };
  }>(
    "/api/v1/transit/departures/multi",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["stopIds"],
          properties: {
            stopIds: { type: "string" },
            subStops: { type: "string" },
            stationId: { type: "string" },
            countPerStop: { type: "string" },
            totalCount: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const ids = request.query.stopIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ids.length === 0) {
        return badRequest("stopIds must not be empty");
      }
      if (ids.length > 20) {
        return badRequest("stopIds must contain at most 20 IDs");
      }

      let subStops: TransitSubStop[] = [];
      if (request.query.subStops) {
        const raw = parseJson(
          request.query.subStops,
          isSubStopArray,
          "subStops must be a JSON array of objects",
        );
        subStops = raw.map(coerceSubStop).filter((s) => s.gtfsId !== "");
      }

      let countPerStop = 10;
      if (request.query.countPerStop) {
        const parsed = Number(request.query.countPerStop);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 30) {
          return badRequest("countPerStop must be a number between 1 and 30");
        }
        countPerStop = parsed;
      }

      let totalCount = 40;
      if (request.query.totalCount) {
        const parsed = Number(request.query.totalCount);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
          return badRequest("totalCount must be a number between 1 and 100");
        }
        totalCount = parsed;
      }

      const stationId = request.query.stationId?.trim() || undefined;

      const { data, cached } = await getMultiStopDepartures(
        ids,
        subStops,
        countPerStop,
        totalCount,
        stationId,
      );
      return { data, cached };
    },
  );

  server.get<{
    Querystring: {
      fromLat: string;
      fromLon: string;
      toLat: string;
      toLon: string;
    };
  }>(
    "/api/v1/transit/plan",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["fromLat", "fromLon", "toLat", "toLon"],
          properties: {
            fromLat: { type: "string" },
            fromLon: { type: "string" },
            toLat: { type: "string" },
            toLon: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const from = parseCoordinates({
        lat: request.query.fromLat,
        lon: request.query.fromLon,
      });
      const to = parseCoordinates({
        lat: request.query.toLat,
        lon: request.query.toLon,
      });

      const { data, cached } = await planRoute(
        from.lat,
        from.lon,
        to.lat,
        to.lon,
      );
      return { data, cached };
    },
  );
};
