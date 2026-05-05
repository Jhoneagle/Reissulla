import "dotenv/config";

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
};
