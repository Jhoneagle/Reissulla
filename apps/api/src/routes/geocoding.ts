import type { FastifyPluginAsync } from "fastify";
import {
  searchGeocode,
  reverseGeocode,
} from "../services/geocoding.service.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";

export const geocodingRoutes: FastifyPluginAsync = async (server) => {
  server.get<{
    Querystring: { q: string; lat?: string; lon?: string };
  }>(
    "/api/v1/geocoding/search",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string" },
            lat: { type: "string" },
            lon: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query.q.trim();
      if (q === "") {
        return badRequest("q must not be empty");
      }

      // Optional focus point for location-biased results
      let focus: { lat: number; lon: number } | undefined;
      if (request.query.lat && request.query.lon) {
        const focusLat = Number(request.query.lat);
        const focusLon = Number(request.query.lon);
        if (
          !Number.isNaN(focusLat) &&
          !Number.isNaN(focusLon) &&
          focusLat >= -90 &&
          focusLat <= 90 &&
          focusLon >= -180 &&
          focusLon <= 180
        ) {
          focus = { lat: focusLat, lon: focusLon };
        }
      }

      try {
        const { data, cached } = await searchGeocode(q, focus);
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to search geocoding");
        return reply.status(502).send({
          error: {
            code: "GEOCODING_UNAVAILABLE",
            message:
              "Geocoding service temporarily unavailable — please try again shortly",
          },
        });
      }
    },
  );

  server.get<{ Querystring: { lat: string; lon: string } }>(
    "/api/v1/geocoding/reverse",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["lat", "lon"],
          properties: {
            lat: { type: "string" },
            lon: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { lat, lon } = parseCoordinates(request.query);

      try {
        const { data, cached } = await reverseGeocode(lat, lon);
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to reverse geocode");
        return reply.status(502).send({
          error: {
            code: "GEOCODING_UNAVAILABLE",
            message:
              "Geocoding service temporarily unavailable — please try again shortly",
          },
        });
      }
    },
  );
};
