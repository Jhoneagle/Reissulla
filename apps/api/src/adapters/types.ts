import type { Persona } from "@reissulla/shared";

/**
 * Threaded through every adapter call as the trailing argument.
 *
 * `persona` is the accessibility + language profile of the requesting user
 * (anonymous or authenticated). Adapters that have persona-affecting upstream
 * arguments — currently only `planConnection` — translate it via the single
 * `personaToPlanArgs` mapping in `@reissulla/shared`. Adapters that don't (yet)
 * use persona simply ignore it.
 *
 * `locale` will join in Phase 2 when adapters start passing the language to
 * upstream search endpoints.
 *
 * `signal` will be populated from a real subscriber cancellation source in
 * Phase 4 SSE.
 */
export interface AdapterContext {
  signal: AbortSignal;
  persona?: Persona;
}
