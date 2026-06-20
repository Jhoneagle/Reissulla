import type { FastifyPluginAsync } from "fastify";
import {
  getActive,
  type AlertFilter,
} from "../services/alerts/alerts.service.js";

/**
 * Splits a comma-separated query value into a trimmed, non-empty list, or
 * `undefined` when nothing usable was passed.
 */
function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/**
 * REST list of the active composed alert set. The default (no filter) returns
 * the full set; the FE filters by its own pins at the edge. The optional
 * `routes` / `stops` / `regions` query params support direct API consumers and
 * back the SSE-off polling fallback.
 *
 * The SSE delta stream lives at `GET /api/v1/alerts/live` (routes/realtime.ts).
 */
export const alertsRoutes: FastifyPluginAsync = async (server) => {
  server.get<{
    Querystring: { routes?: string; stops?: string; regions?: string };
  }>(
    "/api/v1/alerts",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            routes: { type: "string" },
            stops: { type: "string" },
            regions: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const filter: AlertFilter = {
        routes: parseList(request.query.routes),
        stops: parseList(request.query.stops),
        regions: parseList(request.query.regions),
      };
      const hasFilter = Boolean(
        filter.routes || filter.stops || filter.regions,
      );
      const { data, cached } = await getActive(hasFilter ? filter : undefined);
      return { data, cached };
    },
  );
};
