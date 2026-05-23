import type { FastifyPluginAsync } from "fastify";
import { redis } from "../cache/redis.js";
import * as healthRepo from "../db/repositories/health.repo.js";

export const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get("/api/v1/health", async () => {
    let dbStatus = "ok";
    try {
      await healthRepo.ping();
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
