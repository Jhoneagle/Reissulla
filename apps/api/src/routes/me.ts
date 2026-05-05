import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";

export const meRoutes: FastifyPluginAsync = async (server) => {
  server.get("/api/v1/me", { preHandler: requireAuth }, async (request) => {
    return { user: request.session?.user };
  });
};
