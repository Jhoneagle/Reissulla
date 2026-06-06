import { server } from "./server.js";

/**
 * Wired by both `apps/api/test/server.ts` (E2E entry point) and
 * `vitest-setup.ts`. `onUnhandledRequest: 'error'` makes any forgotten
 * upstream a loud failure, not silent live traffic.
 *
 * Note: better-auth issues outbound calls to its own internal URL — they
 * are filtered out via the `bypass: localhost` pattern below so MSW
 * doesn't refuse same-origin Fastify-internal traffic.
 */
server.listen({
  onUnhandledRequest(request, print) {
    const url = new URL(request.url);
    // Same-origin calls (better-auth → /api/auth/*) bypass MSW entirely.
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;
    print.error();
  },
});
