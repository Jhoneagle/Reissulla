import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import {
  list,
  markAllRead,
  markRead,
  unreadCount,
} from "../services/notifications/notifications.service.js";
import { badRequest } from "../utils/validation.js";

/**
 * Notification-centre endpoints. All require a session — the inbox and unread
 * count are inherently per-user. The composed alert set behind them is cached
 * (alerts.service), so polling these stays cheap.
 */
export const notificationsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook("preHandler", requireAuth);

  // Today's relevant alerts with unread flags, plus the unread count so the
  // page and the bell can hydrate from one response.
  server.get("/api/v1/notifications", async (request) => {
    const userId = request.session!.user.id;
    const data = await list(userId);
    return { data, unreadCount: data.filter((n) => n.unread).length };
  });

  // Lightweight count for the nav bell's 60 s poll — avoids shipping the whole
  // alert list when only the badge number is needed.
  server.get("/api/v1/notifications/unread-count", async (request) => {
    const userId = request.session!.user.id;
    return { count: await unreadCount(userId) };
  });

  server.post<{ Body: { alertIds: string[] } }>(
    "/api/v1/notifications/read",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["alertIds"],
          properties: {
            alertIds: {
              type: "array",
              items: { type: "string" },
              maxItems: 500,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.session!.user.id;
      const { alertIds } = request.body;
      if (alertIds.length === 0) {
        return badRequest("alertIds must not be empty");
      }
      await markRead(userId, alertIds);
      return reply.status(204).send();
    },
  );

  server.post("/api/v1/notifications/read-all", async (request, reply) => {
    const userId = request.session!.user.id;
    await markAllRead(userId);
    return reply.status(204).send();
  });
};
