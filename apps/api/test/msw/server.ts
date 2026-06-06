import { setupServer } from "msw/node";
import { externalHandlers } from "./handlers/index.js";

/**
 * Shared MSW server used by both the Vitest setup and the E2E API entry
 * point. The handler set is **closed** — tests must not call
 * `server.use()` against this instance. Adding a new scenario means
 * adding a new fixture file + a new key to the matching registry.
 */
export const server = setupServer(...externalHandlers);
