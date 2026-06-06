import { setupServer } from "msw/node";
import { internalHandlers } from "./handlers/index.js";

/**
 * Jsdom-only MSW server for FE component tests. Per-test `server.use()`
 * IS allowed here — Vitest spawns one worker per test file with its own
 * MSW server instance, so there is no cross-test race.
 *
 * NOT used by Playwright; in E2E the browser talks to a real API.
 */
export const server = setupServer(...internalHandlers);
