import type { FastifyReply } from "fastify";

export type Source =
  | "self"
  | "fastify"
  | "digitransit-finland"
  | "digitransit-hsl"
  | "digitransit-pelias"
  | "open-meteo"
  | "google-oauth"
  | "redis"
  | "db";

export interface ErrorBody {
  code: string;
  message: string;
  source: Source;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly source: Source = "self",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST", source: Source = "self") {
    super(400, code, message, source);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message, "self");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = "NOT_FOUND") {
    super(404, code, message, "self");
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message, "self");
  }
}

export class UpstreamError extends AppError {
  constructor(code: string, message: string, source: Source) {
    super(502, code, message, source);
  }
}

export function errorReply(reply: FastifyReply, err: AppError): FastifyReply {
  return reply.status(err.statusCode).send({
    error: { code: err.code, message: err.message, source: err.source },
  });
}
