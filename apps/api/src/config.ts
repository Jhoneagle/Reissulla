import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";

// Load .env from repo root — Turborepo runs tasks from each package dir,
// so "dotenv/config" alone would look in apps/api/ instead of the repo root.
dotenvConfig({ path: resolve(import.meta.dirname, "../../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 3000),
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
};
