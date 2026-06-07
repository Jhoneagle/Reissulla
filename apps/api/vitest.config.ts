import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
    setupFiles: ["test/msw/vitest-setup.ts"],
    // Many integration tests share a single Redis instance for cache
    // state and re-key against well-known coord buckets (Helsinki). Running
    // test files in parallel lets one file's `beforeEach cacheDel` race
    // another file's just-written value, producing false cache-miss
    // assertions. Forcing single-file execution removes that race at the
    // cost of marginal wall-clock; the per-file suites still parallelise
    // inside themselves through Vitest's worker pool.
    fileParallelism: false,
  },
});
