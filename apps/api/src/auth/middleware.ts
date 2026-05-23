import type { FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { UnauthorizedError } from "../utils/error-envelope.js";

export async function requireAuth(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    throw new UnauthorizedError();
  }

  request.session = session;
}

declare module "fastify" {
  interface FastifyRequest {
    session?: Awaited<ReturnType<typeof auth.api.getSession>>;
  }
}
