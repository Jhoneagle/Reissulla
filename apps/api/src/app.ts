import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { weatherRoutes } from "./routes/weather.js";

export async function buildServer() {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await server.register(healthRoutes);
  await server.register(authRoutes);
  await server.register(meRoutes);
  await server.register(weatherRoutes);

  return server;
}
