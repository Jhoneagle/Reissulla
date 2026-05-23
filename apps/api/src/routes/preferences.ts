import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";
import { parseExtra } from "../db/repositories/preferences-extra.js";
import { badRequest } from "../utils/validation.js";

const TEMPERATURE_UNITS = ["celsius", "fahrenheit"] as const;
const DISTANCE_UNITS = ["metric", "imperial"] as const;
const TIME_FORMATS = ["24h", "12h"] as const;
const LANGUAGES = ["fi", "en"] as const;
const THEMES = ["light", "dark", "system"] as const;
const REDUCE_MOTION = ["on", "off", "system"] as const;

export const preferencesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook("preHandler", requireAuth);

  server.get("/api/v1/preferences", async (request) => {
    const userId = request.session!.user.id;
    const row = await preferencesRepo.findByUserId(userId);
    return { data: row ?? defaultsFor(userId) };
  });

  server.patch<{
    Body: {
      temperatureUnit?: string;
      distanceUnit?: string;
      timeFormat?: string;
      language?: string;
      theme?: string;
      reduceMotion?: string;
      highContrast?: boolean;
      fontScale?: number;
      srOptimised?: boolean;
      extra?: unknown;
    };
  }>(
    "/api/v1/preferences",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            temperatureUnit: { type: "string", enum: [...TEMPERATURE_UNITS] },
            distanceUnit: { type: "string", enum: [...DISTANCE_UNITS] },
            timeFormat: { type: "string", enum: [...TIME_FORMATS] },
            language: { type: "string", enum: [...LANGUAGES] },
            theme: { type: "string", enum: [...THEMES] },
            reduceMotion: { type: "string", enum: [...REDUCE_MOTION] },
            highContrast: { type: "boolean" },
            fontScale: { type: "integer", minimum: 100, maximum: 200 },
            srOptimised: { type: "boolean" },
            extra: { type: "object" },
          },
        },
      },
    },
    async (request) => {
      const userId = request.session!.user.id;
      const body = request.body;

      if (Object.keys(body).length === 0) {
        return badRequest("No fields to update");
      }

      const patch: preferencesRepo.PreferencesPatch = {};
      if (body.temperatureUnit !== undefined)
        patch.temperatureUnit = body.temperatureUnit;
      if (body.distanceUnit !== undefined)
        patch.distanceUnit = body.distanceUnit;
      if (body.timeFormat !== undefined) patch.timeFormat = body.timeFormat;
      if (body.language !== undefined) patch.language = body.language;
      if (body.theme !== undefined) patch.theme = body.theme;
      if (body.reduceMotion !== undefined)
        patch.reduceMotion = body.reduceMotion;
      if (body.highContrast !== undefined)
        patch.highContrast = body.highContrast;
      if (body.fontScale !== undefined) patch.fontScale = body.fontScale;
      if (body.srOptimised !== undefined) patch.srOptimised = body.srOptimised;
      // `extra` goes through parseExtra so a malformed body can't write
      // garbage to the jsonb column.
      if (body.extra !== undefined) patch.extra = parseExtra(body.extra);

      const row = await preferencesRepo.upsert(userId, patch);
      return { data: row };
    },
  );
};

/**
 * Default row shape for users who haven't saved preferences yet. Mirrors
 * the DB column defaults so the FE doesn't need a second code path for
 * "first visit, no row".
 */
function defaultsFor(userId: string): preferencesRepo.PreferencesRow {
  const now = new Date();
  return {
    id: "",
    userId,
    temperatureUnit: "celsius",
    distanceUnit: "metric",
    language: "en",
    timeFormat: "24h",
    transitRegion: "all",
    theme: "system",
    reduceMotion: "system",
    highContrast: false,
    fontScale: 100,
    srOptimised: false,
    extra: {},
    updatedAt: now,
  };
}
