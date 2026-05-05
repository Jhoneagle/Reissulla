import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { redis } from "../cache/redis.js";
import { sql } from "drizzle-orm";

export const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get("/api/v1/health", async () => {
    let dbStatus = "ok";
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = "error";
    }

    let redisStatus = "ok";
    try {
      await redis.ping();
    } catch {
      redisStatus = "error";
    }

    const allOk = dbStatus === "ok" && redisStatus === "ok";

    return {
      status: allOk ? "ok" : "degraded",
      services: {
        db: dbStatus,
        redis: redisStatus,
      },
    };
  });
};
