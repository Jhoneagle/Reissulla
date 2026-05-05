import type { FastifyRequest, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  request.session = session;
}

// Extend Fastify request type
declare module "fastify" {
  interface FastifyRequest {
    session?: Awaited<ReturnType<typeof auth.api.getSession>>;
  }
}
