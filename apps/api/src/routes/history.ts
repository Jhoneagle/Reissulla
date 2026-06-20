import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import * as historyService from "../services/history.service.js";

/**
 * HIST-1 / HIST-2 trip-log surface. All endpoints require auth — the trip log
 * is private to the signed-in user and never shared. The opt-in toggle lives
 * on `preferences.tripLogEnabled`; these endpoints read/clear whatever the
 * planner has already recorded.
 */
export const historyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook("preHandler", requireAuth);

  server.get<{ Querystring: { limit?: string; sinceDays?: string } }>(
    "/api/v1/history/trips",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "string" },
            sinceDays: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const userId = request.session!.user.id;
      const limit = clampInt(request.query.limit, 1, 500);
      const sinceDays = clampInt(request.query.sinceDays, 1, 365);
      const data = await historyService.list(userId, { limit, sinceDays });
      return { data };
    },
  );

  server.delete("/api/v1/history/trips", async (request) => {
    const userId = request.session!.user.id;
    const removed = await historyService.clear(userId);
    return { data: { removed } };
  });

  server.get("/api/v1/history/suggested-pins", async (request) => {
    const userId = request.session!.user.id;
    const data = await historyService.suggestPins(userId);
    return { data };
  });
};

/** Parse a query-string integer, clamping into [min, max]; undefined when absent/garbage. */
function clampInt(
  raw: string | undefined,
  min: number,
  max: number,
): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
