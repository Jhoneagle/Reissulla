import type { Persona } from "@reissulla/shared";

export type AdapterLocale = "fi" | "en";

/**
 * Threaded through every adapter call as the trailing argument.
 *
 * `persona` is the accessibility + language profile of the requesting user
 * (anonymous or authenticated). Adapters that have persona-affecting upstream
 * arguments — currently only `planConnection` — translate it via the single
 * `personaToPlanArgs` mapping in `@reissulla/shared`. Adapters that don't (yet)
 * use persona simply ignore it.
 *
 * `locale` is the resolved request language. Resolution order at the route
 * boundary is: authenticated session → persona.language; anonymous →
 * Accept-Language → "fi". FMI returns localized warning text, so locale-keyed
 * cache entries (`weather:warnings:v2:<region>:<lang>`) start using this field
 * in Phase 3 Chunk 3. Other adapters can ignore it; the field stays required
 * on the contract so locale-dependent upstream calls can never silently
 * forget to thread it.
 *
 * `signal` will be populated from a real subscriber cancellation source in
 * Phase 4 SSE.
 */
export interface AdapterContext {
  signal: AbortSignal;
  locale: AdapterLocale;
  persona?: Persona;
}

/** Derive the locale to use for an adapter call from an attached persona. */
export function localeFromPersona(persona: Persona | undefined): AdapterLocale {
  return persona?.language ?? "fi";
}
