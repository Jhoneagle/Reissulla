import type { FastifyPluginAsync } from "fastify";
import {
  searchGeocode,
  reverseGeocode,
} from "../services/geocoding.service.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";
import { UpstreamError } from "../utils/error-envelope.js";

function geocodingUnavailable(): never {
  throw new UpstreamError(
    "GEOCODING_UNAVAILABLE",
    "Geocoding service temporarily unavailable — please try again shortly",
    "digitransit-pelias",
  );
}

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
    async (request) => {
      const q = request.query.q.trim();
      if (q === "") {
        return badRequest("q must not be empty");
      }

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
        return geocodingUnavailable();
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
    async (request) => {
      const { lat, lon } = parseCoordinates(request.query);

      try {
        const { data, cached } = await reverseGeocode(lat, lon);
        return { data, cached };
      } catch (err) {
        request.log.error(err, "Failed to reverse geocode");
        return geocodingUnavailable();
      }
    },
  );
};
