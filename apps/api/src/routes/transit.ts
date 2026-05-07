import type { FastifyPluginAsync } from "fastify";
import {
  getNearbyStops,
  searchStops,
  getStopDepartures,
  planRoute,
} from "../services/transit.service.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";

export const transitRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/transit/stops — nearby stops by coordinates
  server.get<{
    Querystring: { lat: string; lon: string; radius?: string };
  }>(
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
        return reply.status(502).send({
          error: {
            code: "TRANSIT_UNAVAILABLE",
            message:
              "Transit service temporarily unavailable — please try again shortly",
          },
        });
      }
    },
  );

  // GET /api/v1/transit/stops/search — search stops by name
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
        return reply.status(502).send({
          error: {
            code: "TRANSIT_UNAVAILABLE",
            message:
              "Transit service temporarily unavailable — please try again shortly",
          },
        });
      }
    },
  );

  // GET /api/v1/transit/departures — departures at a stop or station
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
        const { data, cached } = await getStopDepartures(stopId, count, isStation);
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to fetch departures");
        return reply.status(502).send({
          error: {
            code: "TRANSIT_UNAVAILABLE",
            message:
              "Transit service temporarily unavailable — please try again shortly",
          },
        });
      }
    },
  );

  // GET /api/v1/transit/plan — route planning
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
        return reply.status(502).send({
          error: {
            code: "TRANSIT_UNAVAILABLE",
            message:
              "Transit service temporarily unavailable — please try again shortly",
          },
        });
      }
    },
  );
};
