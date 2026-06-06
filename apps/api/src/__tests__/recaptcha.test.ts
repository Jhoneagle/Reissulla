import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { config } from "../config.js";
import { recaptcha } from "@reissulla/test-fixtures";
import {
  getCapturedRequests,
  clearCapturedRequests,
} from "../../test/msw/request-log.js";

const {
  SUCCESS_LOGIN_TOKEN,
  SUCCESS_REGISTER_TOKEN,
  FAILURE_TIMEOUT_DUPLICATE_TOKEN,
  ACTION_MISMATCH_TOKEN,
  NETWORK_ERROR_TOKEN,
  HTTP_503_TOKEN,
} = recaptcha;

const ORIGINAL_SECRET = config.recaptchaSecretKey;
const TEST_SECRET = "test-recaptcha-secret";

beforeAll(async () => {
  await redis.connect();
  (config as { recaptchaSecretKey: string }).recaptchaSecretKey = TEST_SECRET;
});

afterAll(async () => {
  (config as { recaptchaSecretKey: string }).recaptchaSecretKey =
    ORIGINAL_SECRET;
  await redis.quit();
});

function tokenKey(token: string, action: string): string {
  const hash = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `recaptcha:token:v1:${hash}:${action}`;
}

async function clearTokenCache(token: string, action: string) {
  await cacheDel(tokenKey(token, action));
}

async function importVerifier() {
  const mod = await import("../auth/recaptcha.js");
  return mod;
}

describe("verifyRecaptcha — disabled passthrough", () => {
  it("returns disabled=true when no secret is configured", async () => {
    (config as { recaptchaSecretKey: string }).recaptchaSecretKey = "";
    const { verifyRecaptcha } = await importVerifier();

    const result = await verifyRecaptcha("any-token", "login");
    expect(result).toEqual({
      success: true,
      score: 1,
      action: "login",
      hostname: "",
      disabled: true,
    });

    (config as { recaptchaSecretKey: string }).recaptchaSecretKey = TEST_SECRET;
  });

  it("does not call Google when disabled", async () => {
    (config as { recaptchaSecretKey: string }).recaptchaSecretKey = "";
    const { verifyRecaptcha } = await importVerifier();
    clearCapturedRequests();

    await verifyRecaptcha("any-token", "login");

    const upstream = getCapturedRequests().filter((r) =>
      r.url.includes("recaptcha"),
    );
    expect(upstream).toHaveLength(0);

    (config as { recaptchaSecretKey: string }).recaptchaSecretKey = TEST_SECRET;
  });
});

describe("verifyRecaptcha — happy path", () => {
  beforeEach(async () => {
    await clearTokenCache(SUCCESS_LOGIN_TOKEN, "login");
  });

  it("returns the upstream verification facts", async () => {
    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(SUCCESS_LOGIN_TOKEN, "login");

    expect(result).toEqual({
      success: true,
      score: 0.9,
      action: "login",
      hostname: "reissulla.fi",
    });
  });

  it("sends secret + token in x-www-form-urlencoded body", async () => {
    clearCapturedRequests();
    const { verifyRecaptcha } = await importVerifier();
    await verifyRecaptcha(SUCCESS_LOGIN_TOKEN, "login");

    const upstream = getCapturedRequests().filter((r) =>
      r.url.includes("recaptcha"),
    );
    expect(upstream).toHaveLength(1);
    expect(upstream[0]!.method).toBe("POST");

    const params = new URLSearchParams(upstream[0]!.body as string);
    expect(params.get("secret")).toBe(TEST_SECRET);
    expect(params.get("response")).toBe(SUCCESS_LOGIN_TOKEN);
  });
});

describe("verifyRecaptcha — caching", () => {
  beforeEach(async () => {
    await clearTokenCache(SUCCESS_REGISTER_TOKEN, "register");
    await clearTokenCache(SUCCESS_REGISTER_TOKEN, "login");
  });

  it("serves a second call from cache without calling Google", async () => {
    clearCapturedRequests();
    const { verifyRecaptcha } = await importVerifier();

    const first = await verifyRecaptcha(SUCCESS_REGISTER_TOKEN, "register");
    const second = await verifyRecaptcha(SUCCESS_REGISTER_TOKEN, "register");

    const upstream = getCapturedRequests().filter((r) =>
      r.url.includes("recaptcha"),
    );
    expect(upstream).toHaveLength(1);
    expect(second).toEqual(first);

    await clearTokenCache(SUCCESS_REGISTER_TOKEN, "register");
  });

  it("caches per (token, action) — different action triggers a new call", async () => {
    clearCapturedRequests();
    const { verifyRecaptcha } = await importVerifier();

    // First call: register → cached. Second call: same token, different
    // action → fresh upstream hit. The action-mismatch happens because
    // the SUCCESS_REGISTER_TOKEN fixture returns action="register"; the
    // verifier treats it as a failure with reason="action-mismatch"
    // when we ask it to verify action="login". We're only asserting on
    // call count here, not the result.
    await verifyRecaptcha(SUCCESS_REGISTER_TOKEN, "register");
    await verifyRecaptcha(SUCCESS_REGISTER_TOKEN, "login");

    const upstream = getCapturedRequests().filter((r) =>
      r.url.includes("recaptcha"),
    );
    expect(upstream).toHaveLength(2);

    await clearTokenCache(SUCCESS_REGISTER_TOKEN, "register");
    await clearTokenCache(SUCCESS_REGISTER_TOKEN, "login");
  });
});

describe("verifyRecaptcha — failures", () => {
  beforeEach(async () => {
    await clearTokenCache(FAILURE_TIMEOUT_DUPLICATE_TOKEN, "login");
    await clearTokenCache(ACTION_MISMATCH_TOKEN, "login");
    await clearTokenCache(NETWORK_ERROR_TOKEN, "login");
    await clearTokenCache(HTTP_503_TOKEN, "login");
  });

  it("returns success=false with the upstream error code as reason", async () => {
    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(
      FAILURE_TIMEOUT_DUPLICATE_TOKEN,
      "login",
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe("timeout-or-duplicate");
  });

  it("treats action mismatch as failure even when upstream says success", async () => {
    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(ACTION_MISMATCH_TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("action-mismatch");
  });

  it("returns success=false with reason='network' on fetch rejection", async () => {
    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(NETWORK_ERROR_TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("network");
  });

  it("returns success=false with reason='http-503' on upstream HTTP failure", async () => {
    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(HTTP_503_TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("http-503");
  });
});
