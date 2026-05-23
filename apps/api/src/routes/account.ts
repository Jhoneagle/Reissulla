import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { deleteAccount, exportAccount } from "../services/account.service.js";

export const accountRoutes: FastifyPluginAsync = async (server) => {
  server.addHook("preHandler", requireAuth);

  server.get("/api/v1/account/export", async (request, reply) => {
    const userId = request.session!.user.id;
    const exported = await exportAccount(userId);

    // Hint to the browser that this is a download — useful for the Settings
    // "Download my data" button. JSON content type is still set by Fastify.
    reply.header(
      "Content-Disposition",
      `attachment; filename="reissulla-export-${userId}.json"`,
    );
    return exported;
  });

  server.delete("/api/v1/account", async (request, reply) => {
    const userId = request.session!.user.id;
    await deleteAccount(userId);
    return reply.status(204).send();
  });
};
