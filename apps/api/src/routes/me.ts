import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import * as usersRepo from "../db/repositories/users.repo.js";
import { NotFoundError } from "../utils/error-envelope.js";
import { getFeatureFlags } from "../services/featureFlag.service.js";

export const meRoutes: FastifyPluginAsync = async (server) => {
  server.get("/api/v1/me", { preHandler: requireAuth }, async (request) => {
    return { user: request.session?.user };
  });

  /**
   * FE-facing slice of the feature-flag accessor. Anonymous and signed-in
   * users alike read the behaviour gates (e.g. `realtimeSse`) so the hook
   * layer can decide between SSE and 30 s polling without round-tripping
   * to `/api/v1/me`. Feed-level flags stay server-side — the FE has no
   * use for them and exposing them would invite tampering UIs.
   */
  server.get("/api/v1/me/feature-flags", { schema: { hide: true } }, () => {
    const flags = getFeatureFlags();
    return { feature: flags.feature };
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
