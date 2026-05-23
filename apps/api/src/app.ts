import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { weatherRoutes } from "./routes/weather.js";
import { geocodingRoutes } from "./routes/geocoding.js";
import { locationRoutes } from "./routes/locations.js";
import { transitRoutes } from "./routes/transit.js";
import {
  AppError,
  UpstreamError,
  errorReply,
  type Source,
} from "./utils/error-envelope.js";
import { DigitransitError } from "./adapters/digitransit-routing/errors.js";

export async function buildServer() {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  server.setErrorHandler((err: FastifyError, request, reply) => {
    if (err instanceof AppError) {
      return errorReply(reply, err);
    }
    if (err instanceof DigitransitError) {
      return errorReply(
        reply,
        new UpstreamError(
          "TRANSIT_UNAVAILABLE",
          "Transit service temporarily unavailable — please try again shortly",
          err.source as Source,
        ),
      );
    }
    if (err.validation) {
      return reply.status(400).send({
        error: {
          code: "BAD_REQUEST",
          message: err.message,
          source: "fastify" as Source,
        },
      });
    }
    request.log.error(err, "Unhandled error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        source: "self" as Source,
      },
    });
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
