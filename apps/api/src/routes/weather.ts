import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { getCurrentWeather, getWeatherForecast } from "../services/weather.service.js";

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

function parseCoordinates(query: CoordinateQuery): { lat: number; lon: number } {
  const lat = Number(query.lat);
  const lon = Number(query.lon);

  if (query.lat === "" || query.lon === "" || Number.isNaN(lat) || Number.isNaN(lon)) {
    return badRequest("lat and lon must be valid numbers");
  }
  if (lat < -90 || lat > 90) {
    return badRequest("lat must be between -90 and 90");
  }
  if (lon < -180 || lon > 180) {
    return badRequest("lon must be between -180 and 180");
  }

  return { lat, lon };
}

function badRequest(message: string): never {
  const err = new Error(message);
  (err as Error & { statusCode: number }).statusCode = 400;
  throw err;
}

function createWeatherHandler(
  fetcher: (lat: number, lon: number) => Promise<{ data: unknown; cached: boolean }>,
) {
  return async (
    request: FastifyRequest<{ Querystring: CoordinateQuery }>,
    reply: FastifyReply,
  ) => {
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
      return reply.status(502).send({
        error: {
          code: "WEATHER_UNAVAILABLE",
          message: "Weather data temporarily unavailable — please try again shortly",
        },
      });
    }
  };
}

export const weatherRoutes: FastifyPluginAsync = async (server) => {
  const routeOpts = { schema: { querystring: coordinateSchema } };

  server.get("/api/v1/weather/current", routeOpts, createWeatherHandler(getCurrentWeather));
  server.get("/api/v1/weather/forecast", routeOpts, createWeatherHandler(getWeatherForecast));
};
