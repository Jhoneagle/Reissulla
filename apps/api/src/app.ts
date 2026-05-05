import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";

export async function buildServer() {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  // Parse JSON body for auth routes
  server.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await server.register(healthRoutes);
  await server.register(authRoutes);
  await server.register(meRoutes);

  return server;
}
