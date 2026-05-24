import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { badRequest } from "../utils/validation.js";
import { NotFoundError } from "../utils/error-envelope.js";
import * as savedLocationsRepo from "../db/repositories/saved-locations.repo.js";
import * as savedLocationsService from "../services/saved-locations.service.js";

const CATEGORY_VALUES = [
  "home",
  "work",
  "school",
  "cottage",
  "family",
  "hobby",
  "other",
] as const;

export const locationRoutes: FastifyPluginAsync = async (server) => {
  server.addHook("preHandler", requireAuth);

  server.get("/api/v1/locations", async (request) => {
    const userId = request.session!.user.id;
    const rows = await savedLocationsService.listLocations(userId);
    return { data: rows.map(toResponse) };
  });

  server.post<{
    Body: {
      name: string;
      latitude: number;
      longitude: number;
      category?: string;
    };
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
            category: { type: "string", enum: [...CATEGORY_VALUES] },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.session!.user.id;
      const { name, latitude, longitude, category } = request.body;

      const row = await savedLocationsService.createLocation({
        userId,
        name,
        latitude,
        longitude,
        category:
          (category as savedLocationsService.SavedLocationCategory) ?? null,
      });

      return reply.status(201).send({ data: toResponse(row) });
    },
  );

  server.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      isPrimary?: boolean;
      sortOrder?: number;
      category?: string | null;
    };
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
            // null clears the category (e.g. demoting from "home" to "other"
            // without picking a specific replacement category).
            category: {
              type: ["string", "null"],
              enum: [...CATEGORY_VALUES, null],
            },
          },
        },
      },
    },
    async (request) => {
      const userId = request.session!.user.id;
      const { id } = request.params;
      const updates = request.body;

      if (Object.keys(updates).length === 0) {
        return badRequest("No fields to update");
      }

      const row = await savedLocationsService.updateLocation({
        userId,
        id,
        name: updates.name,
        isPrimary: updates.isPrimary,
        sortOrder: updates.sortOrder,
        category:
          updates.category === undefined
            ? undefined
            : (updates.category as savedLocationsService.SavedLocationCategory | null),
      });

      if (!row) {
        throw new NotFoundError("Location not found");
      }

      return { data: toResponse(row) };
    },
  );

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

      const row = await savedLocationsService.deleteLocation(id, userId);

      if (!row) {
        throw new NotFoundError("Location not found");
      }

      return reply.status(204).send();
    },
  );
};

function toResponse(row: savedLocationsRepo.SavedLocationRow) {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    isPrimary: row.isPrimary,
    sortOrder: row.sortOrder,
    region: row.region,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
