import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
    setupFiles: ["test/msw/vitest-setup.ts"],
  },
});
