import { createHash } from "node:crypto";
import { config } from "../config.js";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import { tryCache } from "../utils/resilience.js";

/**
 * reCAPTCHA v3 server-side verification.
 *
 * Behaviour:
 * - Returns the upstream verification facts (success, score, action,
 *   hostname). The caller compares `score` against the configured
 *   threshold and decides how to react — typically: high score continues
 *   the password flow, low score routes through magic-link instead of
 *   showing a challenge UI.
 * - Per-token caching at `recaptcha:token:v1:<hash>` for 5 minutes so a
 *   client retry doesn't burn Google quota or risk a "token already used"
 *   second-call rejection.
 * - When `RECAPTCHA_SECRET_KEY` is unset, returns a disabled-passthrough
 *   verification (success=true, score=1, disabled=true) so dev without
 *   credentials Just Works. Production setups should set the secret.
 */

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const RECAPTCHA_TIMEOUT_MS = 5_000;
const RECAPTCHA_CACHE_TTL_SECONDS = 300;

export type RecaptchaAction = "login" | "register" | "magic-link";

export interface RecaptchaVerification {
  success: boolean;
  score: number;
  action: string;
  hostname: string;
  /** True if recaptcha is disabled (no secret configured); never set by upstream. */
  disabled?: boolean;
  /**
   * Reason verification failed when `success === false`. Includes upstream
   * error codes (`timeout-or-duplicate`, `invalid-input-response`, ...) plus
   * client-side reasons (`network`, `timeout`, `action-mismatch`).
   */
  reason?: string;
}

/** Hashed token segment for cache keys — never store the raw token. */
function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

interface GoogleSiteverifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
}

export async function verifyRecaptcha(
  token: string,
  expectedAction: RecaptchaAction,
): Promise<RecaptchaVerification> {
  if (!config.recaptchaSecretKey) {
    return {
      success: true,
      score: 1,
      action: expectedAction,
      hostname: "",
      disabled: true,
    };
  }

  const key = cacheKey(
    "recaptcha",
    "token",
    1,
    tokenFingerprint(token),
    expectedAction,
  );
  const cached = await tryCache(() => cacheGet<RecaptchaVerification>(key));
  if (cached) return cached;

  const verification = await callSiteverify(token, expectedAction);

  await tryCache(() =>
    cacheSet(key, verification, RECAPTCHA_CACHE_TTL_SECONDS),
  );
  return verification;
}

async function callSiteverify(
  token: string,
  expectedAction: RecaptchaAction,
): Promise<RecaptchaVerification> {
  const body = new URLSearchParams({
    secret: config.recaptchaSecretKey,
    response: token,
  });

  let res: Response;
  try {
    res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(RECAPTCHA_TIMEOUT_MS),
    });
  } catch (err) {
    const reason =
      (err as Error).name === "TimeoutError" ? "timeout" : "network";
    return {
      success: false,
      score: 0,
      action: expectedAction,
      hostname: "",
      reason,
    };
  }

  if (!res.ok) {
    return {
      success: false,
      score: 0,
      action: expectedAction,
      hostname: "",
      reason: `http-${res.status}`,
    };
  }

  const data = (await res.json()) as GoogleSiteverifyResponse;

  // Action mismatch is a strong signal of token replay / wrong-form submission
  // — treat as failure regardless of score.
  if (data.success && data.action && data.action !== expectedAction) {
    return {
      success: false,
      score: data.score ?? 0,
      action: data.action,
      hostname: data.hostname ?? "",
      reason: "action-mismatch",
    };
  }

  return {
    success: data.success,
    score: data.score ?? 0,
    action: data.action ?? expectedAction,
    hostname: data.hostname ?? "",
    reason: data.success ? undefined : data["error-codes"]?.[0],
  };
}

/** Re-exported so call sites in commit 6 can compare against the same constant. */
export const RECAPTCHA_THRESHOLD = config.recaptchaThreshold;
