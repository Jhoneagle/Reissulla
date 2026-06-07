import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  getCurrentWeather,
  getWeatherForecast,
} from "../services/weather.service.js";
import { getWeatherSnapshot } from "../services/weather/composition.service.js";
import { getWarningPolygons } from "../services/weather/warning-polygons.service.js";
import { parseCoordinates } from "../utils/validation.js";
import { UpstreamError } from "../utils/error-envelope.js";
import type { AdapterLocale } from "../adapters/types.js";

interface CoordinateQuery {
  lat: string;
  lon: string;
}

const coordinateSchema = {
  type: "object",
  required: ["lat", "lon"],
  properties: {
    lat: { type: "string" },
    lon: { type: "string" },
  },
};

function createWeatherHandler(
  fetcher: (
    lat: number,
    lon: number,
  ) => Promise<{ data: unknown; cached: boolean }>,
) {
  return async (request: FastifyRequest<{ Querystring: CoordinateQuery }>) => {
    const { lat, lon } = parseCoordinates(request.query);

    try {
      const { data, cached } = await fetcher(lat, lon);
      return {
        data,
        coordinates: { latitude: lat, longitude: lon },
        cached,
      };
    } catch (err) {
      request.log.error(err, "Failed to fetch weather data");
      throw new UpstreamError(
        "WEATHER_UNAVAILABLE",
        "Weather data temporarily unavailable — please try again shortly",
        "open-meteo",
      );
    }
  };
}

function resolveLocale(request: FastifyRequest): AdapterLocale {
  if (request.personaExplicit === true && request.persona !== undefined) {
    return request.persona.language;
  }
  const header = request.headers["accept-language"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw && /\ben\b/i.test(raw) && !/\bfi\b/i.test(raw)) return "en";
  return "fi";
}

export const weatherRoutes: FastifyPluginAsync = async (server) => {
  const routeOpts = { schema: { querystring: coordinateSchema } };

  server.get(
    "/api/v1/weather/current",
    routeOpts,
    createWeatherHandler(getCurrentWeather),
  );
  server.get(
    "/api/v1/weather/forecast",
    routeOpts,
    createWeatherHandler(getWeatherForecast),
  );
  server.get<{ Querystring: { region?: string } }>(
    "/api/v1/weather/warning-polygons",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { region: { type: "string" } },
        },
      },
    },
    async (request) => {
      const locale = resolveLocale(request);
      const region = request.query.region ?? "";
      const { data, cached } = await getWarningPolygons({
        region,
        locale,
        signal: request.raw.aborted ? undefined : new AbortController().signal,
      });
      return {
        data: { polygons: data },
        meta: { cached, region, locale },
      };
    },
  );

  server.get(
    "/api/v1/weather/snapshot",
    routeOpts,
    async (request: FastifyRequest<{ Querystring: CoordinateQuery }>) => {
      const { lat, lon } = parseCoordinates(request.query);
      const locale = resolveLocale(request);
      const { data, meta } = await getWeatherSnapshot(lat, lon, {
        persona: request.persona,
        locale,
      });
      return {
        data,
        meta,
        coordinates: { latitude: lat, longitude: lon },
        locale,
      };
    },
  );
};
