import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Single worker — tests share the same DB / Redis instance,
 * so isolating per-test via unique emails is what keeps them safe to run
 * in parallel across test files but not within a file.
 *
 * The webServer block boots api + web together so `pnpm test:e2e`
 * works end-to-end without manual orchestration. In CI both servers
 * start fresh; locally they reuse whatever's already running.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @reissulla/api dev:e2e",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        // null transport so magic-link sends are inspectable but never hit
        // a real SMTP server during E2E runs.
        EMAIL_TRANSPORT: "null",
        // Empty -> disabled passthrough on verifyRecaptcha. Lets us drive
        // the auth flow without a real grecaptcha widget.
        RECAPTCHA_SECRET_KEY: "",
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @reissulla/web dev",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
    },
  ],
});
