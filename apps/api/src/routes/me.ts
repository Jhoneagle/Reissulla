import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import * as usersRepo from "../db/repositories/users.repo.js";
import { NotFoundError } from "../utils/error-envelope.js";

export const meRoutes: FastifyPluginAsync = async (server) => {
  server.get("/api/v1/me", { preHandler: requireAuth }, async (request) => {
    return { user: request.session?.user };
  });

  server.patch<{ Body: { name: string } }>(
    "/api/v1/me",
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
          },
        },
      },
    },
    async (request) => {
      const userId = request.session!.user.id;
      const row = await usersRepo.updateName(userId, request.body.name.trim());
      if (!row) {
        throw new NotFoundError("User not found");
      }
      return {
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          emailVerified: row.emailVerified,
        },
      };
    },
  );
};
