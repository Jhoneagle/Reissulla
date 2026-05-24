import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { createHash } from "node:crypto";
import { redis } from "../cache/redis.js";
import { cacheDel } from "../cache/cache.js";
import { config } from "../config.js";

// Override the config for these tests so verifyRecaptcha doesn't take the
// disabled-passthrough path. Restored in afterAll.
const ORIGINAL_SECRET = config.recaptchaSecretKey;
const TEST_SECRET = "test-recaptcha-secret";

beforeAll(async () => {
  await redis.connect();
  // Mutating the imported config object — the module reads it dynamically per
  // call, so this lets tests exercise the configured path without spawning a
  // separate server instance.
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

beforeEach(async () => {
  vi.restoreAllMocks();
});

async function importVerifier() {
  // Dynamic import inside each test so the module re-reads `config` at call
  // time. (The module-level `RECAPTCHA_THRESHOLD` snapshot doesn't matter for
  // these tests — we only exercise verifyRecaptcha.)
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
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await verifyRecaptcha("any-token", "login");
    expect(fetchSpy).not.toHaveBeenCalled();

    (config as { recaptchaSecretKey: string }).recaptchaSecretKey = TEST_SECRET;
  });
});

describe("verifyRecaptcha — happy path", () => {
  const TOKEN = "valid-token-123";

  beforeEach(async () => {
    await cacheDel(tokenKey(TOKEN, "login"));
  });

  it("returns the upstream verification facts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.9,
          action: "login",
          hostname: "reissulla.fi",
          challenge_ts: "2026-05-23T10:00:00Z",
        }),
        { status: 200 },
      ),
    );

    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(TOKEN, "login");

    expect(result).toEqual({
      success: true,
      score: 0.9,
      action: "login",
      hostname: "reissulla.fi",
    });
  });

  it("sends secret + token in x-www-form-urlencoded body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.9,
          action: "login",
          hostname: "reissulla.fi",
        }),
        { status: 200 },
      ),
    );

    const { verifyRecaptcha } = await importVerifier();
    await verifyRecaptcha(TOKEN, "login");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://www.google.com/recaptcha/api/siteverify");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("secret")).toBe(TEST_SECRET);
    expect(body.get("response")).toBe(TOKEN);
  });
});

describe("verifyRecaptcha — caching", () => {
  const TOKEN = "cache-test-token";

  beforeEach(async () => {
    await cacheDel(tokenKey(TOKEN, "register"));
  });

  it("serves a second call from cache without calling Google", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.7,
          action: "register",
          hostname: "reissulla.fi",
        }),
        { status: 200 },
      ),
    );

    const { verifyRecaptcha } = await importVerifier();

    const first = await verifyRecaptcha(TOKEN, "register");
    const second = await verifyRecaptcha(TOKEN, "register");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    await cacheDel(tokenKey(TOKEN, "register"));
  });

  it("caches per (token, action) — different action triggers a new call", async () => {
    // Fresh Response per call so the second call doesn't read a consumed body.
    // The mock echoes the action back so the verifier doesn't trip action-mismatch.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const body = (init as RequestInit).body as URLSearchParams;
        // Use the call number as a proxy for which action was requested.
        // First call: register, second call: login (test order).
        const action = fetchSpy.mock.calls.length === 1 ? "register" : "login";
        // Touch body so the urlencoded fixture isn't dropped as unused.
        void body.get("response");
        return new Response(
          JSON.stringify({
            success: true,
            score: 0.7,
            action,
            hostname: "reissulla.fi",
          }),
          { status: 200 },
        );
      });

    const { verifyRecaptcha } = await importVerifier();
    await verifyRecaptcha(TOKEN, "register");
    await verifyRecaptcha(TOKEN, "login");

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await cacheDel(tokenKey(TOKEN, "register"));
    await cacheDel(tokenKey(TOKEN, "login"));
  });
});

describe("verifyRecaptcha — failures", () => {
  const TOKEN = "fail-test-token";

  beforeEach(async () => {
    await cacheDel(tokenKey(TOKEN, "login"));
  });

  it("returns success=false with the upstream error code as reason", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          "error-codes": ["timeout-or-duplicate"],
        }),
        { status: 200 },
      ),
    );

    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("timeout-or-duplicate");
  });

  it("treats action mismatch as failure even when upstream says success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.9,
          action: "register",
          hostname: "reissulla.fi",
        }),
        { status: 200 },
      ),
    );

    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("action-mismatch");
  });

  it("returns success=false with reason='network' on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("network");
  });

  it("returns success=false with reason='http-503' on upstream HTTP failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("upstream down", { status: 503 }),
    );

    const { verifyRecaptcha } = await importVerifier();
    const result = await verifyRecaptcha(TOKEN, "login");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("http-503");
  });
});
