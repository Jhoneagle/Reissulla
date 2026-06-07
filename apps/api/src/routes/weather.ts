import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  getCurrentWeather,
  getWeatherForecast,
} from "../services/weather.service.js";
import { getWeatherSnapshot } from "../services/weather/composition.service.js";
import { getWarningPolygons } from "../services/weather/warning-polygons.service.js";
import { getRainNowcast } from "../services/weather/nowcast.service.js";
import {
  getRadarTileBytes,
  getRadarTimeline,
} from "../services/weather/radar-tiles.service.js";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import { WEATHER_NOWCAST_TTL } from "../cache/ttl.js";
import { tryCache } from "../utils/resilience.js";
import { parseCoordinates } from "../utils/validation.js";
import { UpstreamError } from "../utils/error-envelope.js";
import type { AdapterContext, AdapterLocale } from "../adapters/types.js";
import type { RainNowcast } from "@reissulla/shared";

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

  // Rain / snow nowcast — separate clock from the snapshot so the
  // dashboard live region polls once a minute without dragging in a 14-day
  // hourly fan-out.
  server.get(
    "/api/v1/weather/nowcast",
    routeOpts,
    async (request: FastifyRequest<{ Querystring: CoordinateQuery }>) => {
      const { lat, lon } = parseCoordinates(request.query);
      const locale = resolveLocale(request);
      const key = cacheKey(
        "weather",
        "nowcast",
        1,
        lat.toFixed(2),
        lon.toFixed(2),
      );

      const hit = await tryCache(() => cacheGet<RainNowcast | null>(key));
      if (hit !== undefined && hit !== null) {
        return { data: hit, meta: { cached: true, locale } };
      }

      const ctx: AdapterContext = {
        signal: new AbortController().signal,
        locale,
        persona: request.persona,
      };
      try {
        const data = await getRainNowcast(lat, lon, ctx);
        await tryCache(() => cacheSet(key, data, WEATHER_NOWCAST_TTL));
        return { data, meta: { cached: false, locale } };
      } catch (err) {
        request.log.error(err, "Failed to compute rain nowcast");
        throw new UpstreamError(
          "WEATHER_UNAVAILABLE",
          "Rain nowcast temporarily unavailable — please try again shortly",
          "open-meteo",
        );
      }
    },
  );

  // Sliding radar frame list for the map overlay. `minutesBack` is clamped
  // server-side so a hostile caller can't ask for hours of frames.
  server.get<{ Querystring: { minutesBack?: string } }>(
    "/api/v1/weather/radar/timeline",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { minutesBack: { type: "string" } },
        },
      },
    },
    async (request) => {
      const raw = Number.parseInt(request.query.minutesBack ?? "60", 10);
      const minutesBack = Number.isFinite(raw)
        ? Math.min(120, Math.max(5, raw))
        : 60;
      const locale = resolveLocale(request);
      const ctx: AdapterContext = {
        signal: new AbortController().signal,
        locale,
        persona: request.persona,
      };
      const { frames, cached } = await getRadarTimeline({ minutesBack, ctx });
      return {
        data: { frames },
        meta: { cached, minutesBack },
      };
    },
  );

  // Radar tile passthrough. Params come straight from the FE's TileLayer
  // URL template, e.g. `/weather/radar/1780834800/9/293/146.png`. The
  // service caches both the upstream request and the bytes themselves.
  interface RadarTileParams {
    ts: string;
    z: string;
    x: string;
    y: string;
  }
  server.get<{ Params: RadarTileParams }>(
    "/api/v1/weather/radar/:ts/:z/:x/:y.png",
    {
      schema: {
        params: {
          type: "object",
          required: ["ts", "z", "x", "y"],
          properties: {
            ts: { type: "string" },
            z: { type: "string" },
            x: { type: "string" },
            y: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const timestamp = Number.parseInt(request.params.ts, 10);
      const z = Number.parseInt(request.params.z, 10);
      const x = Number.parseInt(request.params.x, 10);
      const y = Number.parseInt(request.params.y, 10);
      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(z) ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        reply.code(400);
        return { error: { code: "INVALID_RADAR_TILE_COORD" } };
      }
      try {
        const { bytes, contentType } = await getRadarTileBytes({
          timestamp,
          z,
          x,
          y,
          signal: request.raw.aborted ? undefined : undefined,
        });
        reply
          .header("Content-Type", contentType)
          .header("Cache-Control", `public, max-age=${WEATHER_NOWCAST_TTL}`);
        return reply.send(Buffer.from(bytes));
      } catch (err) {
        request.log.error(err, "Failed to proxy FMI radar tile");
        throw new UpstreamError(
          "WEATHER_UNAVAILABLE",
          "Radar tiles temporarily unavailable",
          "fmi",
        );
      }
    },
  );
};
