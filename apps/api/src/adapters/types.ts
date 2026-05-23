/**
 * Threaded through every adapter call as the trailing argument.
 *
 * Phase 0a: signal only.
 * Phase 1 will add `persona?: Persona` and `locale: "fi" | "en"`.
 * Phase 4 SSE will populate `signal` from a real subscriber cancellation source.
 */
export interface AdapterContext {
  signal: AbortSignal;
}
