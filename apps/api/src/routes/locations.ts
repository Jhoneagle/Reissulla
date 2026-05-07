import type { FastifyPluginAsync } from "fastify";
import { eq, and, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { savedLocations } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { badRequest } from "../utils/validation.js";

const MAX_SAVED_LOCATIONS = 20;

export const locationRoutes: FastifyPluginAsync = async (server) => {
  // All routes require authentication
  server.addHook("preHandler", requireAuth);

  // GET /api/v1/locations — list all saved locations for the user
  server.get("/api/v1/locations", async (request) => {
    const userId = request.session!.user.id;

    const locations = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, userId))
      .orderBy(savedLocations.sortOrder, savedLocations.createdAt);

    return {
      data: locations.map(toResponse),
    };
  });

  // POST /api/v1/locations — save a new location
  server.post<{
    Body: { name: string; latitude: number; longitude: number };
  }>(
    "/api/v1/locations",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "latitude", "longitude"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.session!.user.id;
      const { name, latitude, longitude } = request.body;

      // Check limit
      const result = await db
        .select({ value: count() })
        .from(savedLocations)
        .where(eq(savedLocations.userId, userId));

      const existing = result[0]?.value ?? 0;

      if (existing >= MAX_SAVED_LOCATIONS) {
        return reply.status(409).send({
          error: {
            code: "LIMIT_REACHED",
            message: `You can save up to ${MAX_SAVED_LOCATIONS} locations`,
          },
        });
      }

      // First saved location becomes primary
      const isPrimary = existing === 0;

      const [location] = await db
        .insert(savedLocations)
        .values({
          userId,
          name,
          latitude,
          longitude,
          isPrimary,
          sortOrder: existing,
        })
        .returning();

      return reply.status(201).send({ data: toResponse(location!) });
    },
  );

  // PATCH /api/v1/locations/:id — update a saved location
  server.patch<{
    Params: { id: string };
    Body: { name?: string; isPrimary?: boolean; sortOrder?: number };
  }>(
    "/api/v1/locations/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            isPrimary: { type: "boolean" },
            sortOrder: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.session!.user.id;
      const { id } = request.params;
      const updates = request.body;

      if (Object.keys(updates).length === 0) {
        return badRequest("No fields to update");
      }

      // If setting as primary, clear other primaries first
      if (updates.isPrimary) {
        await db
          .update(savedLocations)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(savedLocations.userId, userId));
      }

      const [location] = await db
        .update(savedLocations)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)),
        )
        .returning();

      if (!location) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Location not found" },
        });
      }

      return { data: toResponse(location) };
    },
  );

  // DELETE /api/v1/locations/:id — remove a saved location
  server.delete<{ Params: { id: string } }>(
    "/api/v1/locations/:id",
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
      const { id } = request.params;

      const [deleted] = await db
        .delete(savedLocations)
        .where(
          and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)),
        )
        .returning();

      if (!deleted) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Location not found" },
        });
      }

      return reply.status(204).send();
    },
  );
};

function toResponse(row: typeof savedLocations.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    isPrimary: row.isPrimary,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
