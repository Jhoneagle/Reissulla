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
  return extractPersona(prefs?.extra);
}

/**
 * Best-effort extraction of `extra.persona` from the raw jsonb column. A
 * proper zod-validated schema for `preferences.extra` lands in the next
 * commit; until then we shape-check inline so malformed rows don't poison
 * the request.
 */
function extractPersona(extra: unknown): Persona | null {
  if (typeof extra !== "object" || extra === null) return null;
  const candidate = (extra as Record<string, unknown>).persona;
  if (typeof candidate !== "object" || candidate === null) return null;

  const c = candidate as Record<string, unknown>;
  const lang = c.language === "fi" || c.language === "en" ? c.language : "en";
  return {
    wheelchair: c.wheelchair === true,
    lowFloor: c.lowFloor === true,
    noStairs: c.noStairs === true,
    stroller: c.stroller === true,
    screenReader: c.screenReader === true,
    lowVision: c.lowVision === true,
    language: lang,
  };
}

declare module "fastify" {
  interface FastifyRequest {
    persona?: Persona;
  }
}
