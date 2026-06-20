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

/**
 * Resolve the signed-in user id without forcing auth — returns null for
 * anonymous requests instead of throwing. Used by auth-optional endpoints
 * (the plan route) that behave differently for signed-in users (trip-log
 * capture) but stay open to everyone. A probe failure degrades to anonymous.
 */
export async function getOptionalUserId(
  request: FastifyRequest,
): Promise<string | null> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    session?: Awaited<ReturnType<typeof auth.api.getSession>>;
  }
}
