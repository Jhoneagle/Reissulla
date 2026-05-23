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
  feedFinlandEnabled: process.env.FEED_FINLAND_ENABLED !== "false",
  feedHslEnabled: process.env.FEED_HSL_ENABLED !== "false",
  rateLimitMax: positiveIntEnv("RATE_LIMIT_MAX", 200),
  recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY ?? "",
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY ?? "",
  // Score floor for reCAPTCHA v3 — requests under this score fall back to
  // magic-link in the auth flow. Default matches Google's documented
  // "treat as bot" threshold.
  recaptchaThreshold: thresholdEnv("RECAPTCHA_THRESHOLD", 0.5),
};
