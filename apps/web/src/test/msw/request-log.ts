/**
 * Per-worker request log for FE component tests that need to assert on
 * outgoing request bodies (e.g. that a pin-line click POSTed the right
 * payload). Mirrors the API-side request log but lives in jsdom land.
 */

export interface CapturedRequest {
  url: string;
  method: string;
  /** Parsed JSON body for JSON requests, raw text otherwise, null for GET. */
  body: unknown;
}

const buffer: CapturedRequest[] = [];

export function recordRequest(req: CapturedRequest): void {
  buffer.push(req);
}

export function getCapturedRequests(): readonly CapturedRequest[] {
  return buffer;
}

export function getLastMutation(
  predicate: (req: CapturedRequest) => boolean,
): CapturedRequest | undefined {
  for (let i = buffer.length - 1; i >= 0; i -= 1) {
    if (predicate(buffer[i]!)) return buffer[i]!;
  }
  return undefined;
}

export function clearCapturedRequests(): void {
  buffer.length = 0;
}
