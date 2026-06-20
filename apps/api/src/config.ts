import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";

// Load .env from repo root — Turborepo runs tasks from each package dir,
// so "dotenv/config" alone would look in apps/api/ instead of the repo root.
dotenvConfig({ path: resolve(import.meta.dirname, "../../../.env") });

function positiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`Invalid ${name}="${raw}" — expected a positive integer`);
  }
  return n;
}

function thresholdEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(
      `Invalid ${name}="${raw}" — expected a number between 0 and 1`,
    );
  }
  return n;
}

export const config = {
  port: positiveIntEnv("PORT", 3000),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://reissulla:reissulla_dev@localhost:5432/reissulla",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  authSecret: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  digitransitApiKey: process.env.DIGITRANSIT_API_KEY ?? "",
  // FMI's fair-use policy expects a contactable User-Agent on every WFS/WMS
  // hit; a generic default keeps dev unblocked but production should set this.
  fmiUserAgent:
    process.env.FMI_USER_AGENT ?? "reissulla-dev <dev@reissulla.local>",
  // Fintraffic publishes traffic + road-condition feeds. Empty string means
  // "use the adapter default"; the adapter holds the canonical public URL.
  fintrafficApiBase: process.env.FINTRAFFIC_API_BASE ?? "",
  feedFinlandEnabled: process.env.FEED_FINLAND_ENABLED !== "false",
  feedHslEnabled: process.env.FEED_HSL_ENABLED !== "false",
  feedWalttiEnabled: process.env.FEED_WALTTI_ENABLED !== "false",
  feedVarelyEnabled: process.env.FEED_VARELY_ENABLED !== "false",
  // Master kill-switch for the SSE pipeline (channels, bus, registry, /live
  // routes). Off by default — Chunk 2 flips it on in dev once the first
  // consumer ships; production stays off until the closeout E2E sweep passes.
  realtimeSseEnabled: process.env.REALTIME_SSE_ENABLED === "true",
  // Selects the RealtimeBus implementation. "memory" is the default
  // (single-instance Hetzner box); "redis-pubsub" reuses the existing
  // cache/redis.ts client so a second API instance is a config flip.
  realtimeBus:
    process.env.REALTIME_BUS === "redis-pubsub" ? "redis-pubsub" : "memory",
  // Digitransit MQTT broker. Blank disables the live vehicle stream
  // entirely — the line-vehicles channel falls straight to the polled
  // GraphQL fallback, so tests never reach the network.
  mqttBrokerUrl: process.env.MQTT_BROKER_URL ?? "",
  mqttUsername: process.env.MQTT_USERNAME ?? "",
  mqttPassword: process.env.MQTT_PASSWORD ?? "",
  // How long the MQTT broker may stay unreachable before the adapter
  // degrades to the polled `vehiclePositions` GraphQL fallback and raises
  // `freshness.degraded`. Reconnecting clears it.
  mqttFallbackAfterMs: positiveIntEnv("MQTT_FALLBACK_AFTER_MS", 60_000),
  // Polling cadence for the degraded GraphQL fallback (same data, slower).
  realtimeVehicleFallbackPollMs: positiveIntEnv(
    "REALTIME_VEHICLE_FALLBACK_POLL_MS",
    5000,
  ),
  // Coalesce cadence for the per-line vehicle channel: pings accumulate in
  // memory and the full snapshot publishes on this clock, bounding SSE
  // bandwidth on busy lines. Tests lower it to observe a tick quickly.
  realtimeVehiclePublishMs: positiveIntEnv("REALTIME_VEHICLE_PUBLISH_MS", 1000),
  // Drop a vehicle from the live set when no ping has arrived for this long,
  // so dots for vehicles that left service disappear from the map.
  realtimeVehicleStaleMs: positiveIntEnv("REALTIME_VEHICLE_STALE_MS", 90_000),
  // Shared poller cadence for alerts.service.streamActive — Chunk 4 consumer.
  alertsPollIntervalSec: positiveIntEnv("ALERTS_POLL_INTERVAL_SEC", 60),
  // Per-stop live-departures poll cadence. 5 s gives an upper-bound latency
  // budget for the "live ETA updates land ≤ 5 s after upstream realtime
  // change" acceptance gate; tests set it to a few ms via the env var to
  // observe two ticks deterministically inside an it() block.
  realtimeStopPollMs: positiveIntEnv("REALTIME_STOP_POLL_MS", 5000),
  // Default trip-log retention window for the Chunk 7 nightly prune cron.
  historyRetentionDaysDefault: positiveIntEnv(
    "HISTORY_RETENTION_DAYS_DEFAULT",
    90,
  ),
  rateLimitMax: positiveIntEnv("RATE_LIMIT_MAX", 200),
  recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY ?? "",
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY ?? "",
  // Score floor for reCAPTCHA v3 — requests under this score fall back to
  // magic-link in the auth flow. Default matches Google's documented
  // "treat as bot" threshold.
  recaptchaThreshold: thresholdEnv("RECAPTCHA_THRESHOLD", 0.5),
};
