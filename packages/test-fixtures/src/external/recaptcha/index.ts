/**
 * reCAPTCHA siteverify response shapes. Google documents these as stable,
 * so no live capture is needed; the registry stores canonical examples
 * keyed by the token the test wants to drive.
 *
 * Tests pick a scenario by sending the matching token in the verify call.
 */

export interface RecaptchaSiteverifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
}

/** Happy-path login: high score, hostname matches. */
export const SUCCESS_LOGIN_TOKEN = "test-token-success-login";
/** Happy-path register: medium score, distinct from login so cache scenarios separate. */
export const SUCCESS_REGISTER_TOKEN = "test-token-success-register";
/** Low score for the magic-link-fallback path. */
export const LOW_SCORE_TOKEN = "test-token-low-score";
/** Upstream returned success=false with an error-code. */
export const FAILURE_TIMEOUT_DUPLICATE_TOKEN = "test-token-failure-tod";
export const FAILURE_INVALID_INPUT_TOKEN = "test-token-failure-invalid";
/** Upstream success but the action differs from what the verifier expects. */
export const ACTION_MISMATCH_TOKEN = "test-token-action-mismatch";
/** Network-level error simulated by MSW. */
export const NETWORK_ERROR_TOKEN = "test-token-network-error";
/** HTTP 503 from upstream. */
export const HTTP_503_TOKEN = "test-token-http-503";

export type RecaptchaFixture =
  | { kind: "ok"; body: RecaptchaSiteverifyResponse }
  | { kind: "http"; status: number }
  | { kind: "network" };

export const responsesByToken: Record<string, RecaptchaFixture> = {
  [SUCCESS_LOGIN_TOKEN]: {
    kind: "ok",
    body: {
      success: true,
      score: 0.9,
      action: "login",
      hostname: "reissulla.fi",
      challenge_ts: "2026-05-23T10:00:00Z",
    },
  },
  [SUCCESS_REGISTER_TOKEN]: {
    kind: "ok",
    body: {
      success: true,
      score: 0.7,
      action: "register",
      hostname: "reissulla.fi",
    },
  },
  [LOW_SCORE_TOKEN]: {
    kind: "ok",
    body: {
      success: true,
      score: 0.2,
      action: "login",
      hostname: "reissulla.fi",
    },
  },
  [FAILURE_TIMEOUT_DUPLICATE_TOKEN]: {
    kind: "ok",
    body: {
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    },
  },
  [FAILURE_INVALID_INPUT_TOKEN]: {
    kind: "ok",
    body: {
      success: false,
      "error-codes": ["invalid-input-response"],
    },
  },
  [ACTION_MISMATCH_TOKEN]: {
    kind: "ok",
    body: {
      success: true,
      score: 0.9,
      action: "register",
      hostname: "reissulla.fi",
    },
  },
  [NETWORK_ERROR_TOKEN]: { kind: "network" },
  [HTTP_503_TOKEN]: { kind: "http", status: 503 },
};
