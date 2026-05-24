import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { meRoutes } from "./routes/me.js";
import { preferencesRoutes } from "./routes/preferences.js";
import { weatherRoutes } from "./routes/weather.js";
import { geocodingRoutes } from "./routes/geocoding.js";
import { locationRoutes } from "./routes/locations.js";
import { recentPlacesRoutes } from "./routes/recent-places.js";
import { transitRoutes } from "./routes/transit.js";
import {
  AppError,
  UpstreamError,
  errorReply,
  type Source,
} from "./utils/error-envelope.js";
import { DigitransitError } from "./adapters/digitransit-routing/errors.js";
import { attachPersona } from "./auth/persona.middleware.js";

export async function buildServer() {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  // CSP is configured at the nginx layer (FE/API share an origin behind nginx);
  // disabling here keeps Fastify from setting a conflicting policy.
  await server.register(helmet, { contentSecurityPolicy: false });

  await server.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/api/v1/health",
  });

  // OpenAPI spec generated from the JSON Schemas already declared on each
  // route. Exposed at /api/v1/openapi.json (machine-readable) and an
  // interactive viewer at /api/v1/docs. The spec is also written to a
  // snapshot file on `pnpm api:snapshot-openapi` for review in PRs.
  await server.register(swagger, {
    openapi: {
      info: {
        title: "Reissulla API",
        description:
          "Weather + transit + identity API for Reissulla. See roadmap.md " +
          "for scope and external-apis.md for upstream integrations.",
        version: "1.0.0",
      },
      servers: [{ url: "/" }],
    },
    hideUntagged: false,
  });
  await server.register(swaggerUi, {
    routePrefix: "/api/v1/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
  server.get("/api/v1/openapi.json", async () => server.swagger());

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
    // Fastify body-parser errors, rate-limit 429s, and other plugin-thrown
    // FastifyErrors carry a statusCode + code we should preserve in the
    // envelope rather than burying as 500.
    if (
      typeof err.statusCode === "number" &&
      err.statusCode >= 400 &&
      err.statusCode < 500
    ) {
      return reply.status(err.statusCode).send({
        error: {
          code: err.code ?? "BAD_REQUEST",
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

  // Decorate request.persona before any /api/v1/* handler runs. Skipped for
  // health (frequent, doesn't need persona) and /api/auth/* (handled by
  // better-auth's own pipeline; persona context is meaningless there).
  server.addHook("preHandler", async (request) => {
    if (
      request.url === "/api/v1/health" ||
      request.url.startsWith("/api/auth/")
    ) {
      return;
    }
    await attachPersona(request);
  });

  await server.register(healthRoutes);
  await server.register(authRoutes);
  await server.register(accountRoutes);
  await server.register(meRoutes);
  await server.register(preferencesRoutes);
  await server.register(weatherRoutes);
  await server.register(geocodingRoutes);
  await server.register(locationRoutes);
  await server.register(recentPlacesRoutes);
  await server.register(transitRoutes);

  return server;
}
