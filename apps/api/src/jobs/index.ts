import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { pruneAlertSeen } from "./prune-alert-seen.js";

/**
 * Register the API's scheduled background jobs. Called once from the real
 * server entrypoint (server.ts), never from the test server build, so cron
 * timers never start during vitest.
 *
 * Helsinki TZ is explicit because node's default is UTC and we want the
 * lowest-local-traffic slot (04:00), not 04:00 UTC.
 */
export function registerJobs(log: FastifyBaseLogger): void {
  cron.schedule(
    "0 4 * * *",
    () => {
      pruneAlertSeen()
        .then((removed) => log.info({ removed }, "prune-alert-seen completed"))
        .catch((err) => log.error(err, "prune-alert-seen failed"));
    },
    { timezone: "Europe/Helsinki" },
  );
}
