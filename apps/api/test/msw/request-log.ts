/**
 * Per-worker request log for tests that need to assert on outgoing
 * request bodies (e.g. persona-per-adapter.test.ts verifying that the
 * `wheelchair: { enabled: true }` preference reaches Digitransit).
 *
 * This is per-test-process state, not per-test mutation of MSW handlers
 * — so it doesn't violate the closed-set rule. Vitest spawns one worker
 * per test file, so each spec gets its own buffer.
 */

export interface CapturedRequest {
  url: string;
  method: string;
  /** Parsed JSON body if Content-Type is JSON; raw string otherwise. */
  body: unknown;
  headers: Record<string, string>;
}

const buffer: CapturedRequest[] = [];

export function recordRequest(req: CapturedRequest): void {
  buffer.push(req);
}

export function getCapturedRequests(): readonly CapturedRequest[] {
  return buffer;
}

export function getLastRequest(): CapturedRequest | undefined {
  return buffer.at(-1);
}

export function clearCapturedRequests(): void {
  buffer.length = 0;
}
