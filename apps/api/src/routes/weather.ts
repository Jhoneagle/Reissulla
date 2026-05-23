import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  getCurrentWeather,
  getWeatherForecast,
} from "../services/weather.service.js";
import { parseCoordinates } from "../utils/validation.js";
import { UpstreamError } from "../utils/error-envelope.js";

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
};
