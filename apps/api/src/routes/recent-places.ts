import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { NotFoundError } from "../utils/error-envelope.js";
import * as recentPlacesRepo from "../db/repositories/recent-places.repo.js";

const MAX_LIMIT = 50;

export const recentPlacesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook("preHandler", requireAuth);

  server.get<{ Querystring: { limit?: string } }>(
    "/api/v1/recent-places",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { limit: { type: "string" } },
        },
      },
    },
    async (request) => {
      const userId = request.session!.user.id;
      const limit = parseLimit(request.query.limit);
      const rows = await recentPlacesRepo.listByUser(userId, limit);
      return { data: rows.map(toResponse) };
    },
  );

  server.post<{
    Body: { latitude: number; longitude: number; displayName: string };
  }>(
    "/api/v1/recent-places",
    {
      schema: {
        body: {
          type: "object",
          required: ["latitude", "longitude", "displayName"],
          properties: {
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
            displayName: { type: "string", minLength: 1, maxLength: 255 },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.session!.user.id;
      const row = await recentPlacesRepo.recordVisit({
        userId,
        latitude: request.body.latitude,
        longitude: request.body.longitude,
        displayName: request.body.displayName,
      });
      // visitCount is included in the response — the FE shows a "save this?"
      // prompt when count crosses 3 (LOC-8).
      return reply.status(201).send({ data: toResponse(row) });
    },
  );

  server.delete<{ Params: { id: string } }>(
    "/api/v1/recent-places/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const userId = request.session!.user.id;
      const row = await recentPlacesRepo.deleteByIdForUser(
        request.params.id,
        userId,
      );
      if (!row) {
        throw new NotFoundError("Recent place not found");
      }
      return reply.status(204).send();
    },
  );

  server.delete("/api/v1/recent-places", async (request, reply) => {
    const userId = request.session!.user.id;
    await recentPlacesRepo.clearForUser(userId);
    return reply.status(204).send();
  });
};

function parseLimit(raw: string | undefined): number {
  if (!raw) return 20;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 20;
  return Math.min(n, MAX_LIMIT);
}

function toResponse(row: recentPlacesRepo.RecentPlaceRow) {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    displayName: row.displayName,
    visitCount: row.visitCount,
    lastVisitedAt: row.lastVisitedAt.toISOString(),
  };
}
