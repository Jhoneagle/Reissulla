import type { FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import {
  DEFAULT_PERSONA,
  PERSONA_HEADER,
  parsePersona,
  type Persona,
} from "@reissulla/shared";
import { auth } from "./auth.js";
import * as preferencesRepo from "../db/repositories/preferences.repo.js";

/**
 * Decorate `request.persona` so adapters can consume it via AdapterContext.
 *
 * Source priority:
 *   1. `x-reissulla-persona` header (set by the SPA on every request).
 *   2. `preferences.extra.persona` for authenticated users — covers cases
 *      where the client can't set a header (Phase 4 SSE via EventSource).
 *   3. DEFAULT_PERSONA (all-false / lang=en).
 *
 * The DB fallback only fires when the header is absent AND the session check
 * succeeds; failures degrade silently to the default rather than blocking the
 * request.
 */
export async function attachPersona(request: FastifyRequest): Promise<void> {
  const raw = request.headers[PERSONA_HEADER];
  const headerStr = Array.isArray(raw) ? raw[0] : raw;

  if (headerStr) {
    request.persona = parsePersona(headerStr);
    return;
  }

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (session) {
      const stored = await loadStoredPersona(session.user.id);
      if (stored) {
        request.persona = stored;
        return;
      }
    }
  } catch {
    // Auth probe failure is not fatal — treat as anonymous.
  }

  request.persona = { ...DEFAULT_PERSONA };
}

async function loadStoredPersona(userId: string): Promise<Persona | null> {
  const prefs = await preferencesRepo.findByUserId(userId);
  return prefs?.extra.persona ?? null;
}

declare module "fastify" {
  interface FastifyRequest {
    persona?: Persona;
  }
}
