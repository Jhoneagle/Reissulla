import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { TransitSubStop } from "@reissulla/shared";
import {
  getNearbyStops,
  searchStops,
  getStopDepartures,
  getMultiStopDepartures,
  planRoute,
} from "../services/transit.service.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";

function transitUnavailable(reply: FastifyReply) {
  return reply.status(502).send({
    error: {
      code: "TRANSIT_UNAVAILABLE",
      message:
        "Transit service temporarily unavailable — please try again shortly",
    },
  });
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
    async (request, reply) => {
      const { lat, lon } = parseCoordinates(request.query);

      let radius = 500;
      if (request.query.radius) {
        const parsed = Number(request.query.radius);
        if (Number.isNaN(parsed) || parsed < 100 || parsed > 2000) {
          return badRequest("radius must be a number between 100 and 2000");
        }
        radius = parsed;
      }

      try {
        const { data, cached } = await getNearbyStops(lat, lon, radius);
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to fetch nearby stops");
        return transitUnavailable(reply);
      }
    },
  );

  server.get<{ Querystring: { q: string } }>(
    "/api/v1/transit/stops/search",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query.q.trim();
      if (q === "") {
        return badRequest("q must not be empty");
      }

      try {
        const { data, cached } = await searchStops(q);
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to search stops");
        return transitUnavailable(reply);
      }
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
    async (request, reply) => {
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

      try {
        const isStation = request.query.isStation === "true";
        const { data, cached } = await getStopDepartures(
          stopId,
          count,
          isStation,
        );
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to fetch departures");
        return transitUnavailable(reply);
      }
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
    async (request, reply) => {
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
        try {
          const parsed = JSON.parse(request.query.subStops);
          if (!Array.isArray(parsed)) {
            return badRequest("subStops must be a JSON array");
          }
          subStops = parsed.map((s: Record<string, unknown>) => ({
            gtfsId: String(s.gtfsId ?? ""),
            code: s.code != null ? String(s.code) : null,
            platformCode:
              s.platformCode != null ? String(s.platformCode) : null,
            vehicleMode: s.vehicleMode != null ? String(s.vehicleMode) : null,
          }));
          subStops = subStops.filter((s) => s.gtfsId !== "");
        } catch {
          return badRequest("subStops must be valid JSON");
        }
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

      try {
        const { data, cached } = await getMultiStopDepartures(
          ids,
          subStops,
          countPerStop,
          totalCount,
          stationId,
        );
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to fetch multi-stop departures");
        return transitUnavailable(reply);
      }
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
    async (request, reply) => {
      const from = parseCoordinates({
        lat: request.query.fromLat,
        lon: request.query.fromLon,
      });
      const to = parseCoordinates({
        lat: request.query.toLat,
        lon: request.query.toLon,
      });

      try {
        const { data, cached } = await planRoute(
          from.lat,
          from.lon,
          to.lat,
          to.lon,
        );
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to plan route");
        return transitUnavailable(reply);
      }
    },
  );
};
