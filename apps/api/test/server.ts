/**
 * E2E entry point for the API process.
 *
 * Installs MSW (intercepts all outbound calls to Open-Meteo, Digitransit,
 * reCAPTCHA siteverify) BEFORE the real server boots — so the very first
 * upstream call from a route is already intercepted.
 *
 * `apps/api/src/server.ts` is untouched; this file is the only entry
 * Playwright's webServer points at. The whole `apps/api/test/` tree is
 * outside `apps/api/tsconfig.json`'s build include, so this file never
 * lands in `dist/`.
 */
import "./msw/install.js";
await import("../src/server.js");
