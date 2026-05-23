import type { FastifyPluginAsync } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth.js";
import { AppError } from "../utils/error-envelope.js";

export const authRoutes: FastifyPluginAsync = async (server) => {
  server.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(
          request.url,
          `http://${request.headers.host ?? "localhost"}`,
        );
        const headers = fromNodeHeaders(request.headers);

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        });

        const response = await auth.handler(req);
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));

        const text = await response.text();
        return reply.send(text || null);
      } catch (error) {
        request.log.error(error, "Authentication handler error");
        throw new AppError(500, "AUTH_ERROR", "Internal error", "self");
      }
    },
  });
};
