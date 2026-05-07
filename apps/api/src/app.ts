import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { weatherRoutes } from "./routes/weather.js";
import { geocodingRoutes } from "./routes/geocoding.js";
import { locationRoutes } from "./routes/locations.js";
import { transitRoutes } from "./routes/transit.js";

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
  await server.register(geocodingRoutes);
  await server.register(locationRoutes);
  await server.register(transitRoutes);

  return server;
}
