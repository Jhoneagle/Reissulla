import { BadRequestError } from "./error-envelope.js";

/**
 * Parse a JSON string from external input (query string, request body) and
 * narrow it through a type guard. Throws BadRequestError on parse failure or
 * shape mismatch — the global error handler maps that to a 400 envelope.
 *
 * Use this at trust boundaries. For internal-trust JSON (e.g. Redis values
 * the API itself wrote), a plain JSON.parse with a typed cast is acceptable.
 */
export function parseJson<T>(
  raw: string,
  guard: (value: unknown) => value is T,
  failureMessage = "Unexpected JSON shape",
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestError("Invalid JSON");
  }
  if (!guard(parsed)) {
    throw new BadRequestError(failureMessage);
  }
  return parsed;
}
