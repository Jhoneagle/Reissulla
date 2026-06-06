import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.js";
import { clearCapturedRequests } from "./request-log.js";

/**
 * Vitest lifecycle for the API MSW server. The handler set is closed —
 * `resetHandlers` is a no-op against the closed-set, kept for symmetry.
 * The request-log buffer is per-worker (Vitest spawns one worker per
 * test file) so clearing on `afterEach` keeps assertions scoped.
 */
beforeAll(() => {
  server.listen({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;
      print.error();
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  clearCapturedRequests();
});

afterAll(() => {
  server.close();
});
