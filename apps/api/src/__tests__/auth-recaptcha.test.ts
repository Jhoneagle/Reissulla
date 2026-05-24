import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { redis } from "../cache/redis.js";
import {
  createNullTransport,
  setEmailTransportForTesting,
  type NullTransport,
} from "../email/transport.js";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { user, session, account } from "../db/schema.js";
import { inArray } from "drizzle-orm";

// Mock the recaptcha verifier so we can dial the score per test without
// touching config.recaptchaSecretKey (which is read by every concurrent
// test file and would race).
vi.mock("../auth/recaptcha.js", () => ({
  verifyRecaptcha: vi.fn(),
  RECAPTCHA_THRESHOLD: 0.5,
}));

const { verifyRecaptcha } = await import("../auth/recaptcha.js");
const verifyMock = vi.mocked(verifyRecaptcha);

let server: FastifyInstance;
let nullTransport: NullTransport;
const createdEmails: string[] = [];

const uniqueEmail = () => {
  const email = `test-recaptcha-${Date.now()}-${Math.random().toString(36).slice(2)}@test.reissulla.local`;
  createdEmails.push(email);
  return email;
};

beforeAll(async () => {
  await redis.connect();
  const { buildServer } = await import("../app.js");
  server = await buildServer();
  nullTransport = createNullTransport();
  setEmailTransportForTesting(nullTransport);
});

afterAll(async () => {
  setEmailTransportForTesting(undefined);

  if (createdEmails.length > 0) {
    const testUsers = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, createdEmails));

    if (testUsers.length > 0) {
      const ids = testUsers.map((u) => u.id);
      await db.delete(session).where(inArray(session.userId, ids));
      await db.delete(account).where(inArray(account.userId, ids));
      await db.delete(user).where(inArray(user.id, ids));
    }
  }

  await server.close();
  await redis.quit();
});

beforeEach(() => {
  verifyMock.mockReset();
  nullTransport.reset();
});

describe("Auth — reCAPTCHA gate", () => {
  it("allows password sign-up when score is at or above the threshold", async () => {
    verifyMock.mockResolvedValueOnce({
      success: true,
      score: 0.9,
      action: "register",
      hostname: "test",
    });

    const email = uniqueEmail();
    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "content-type": "application/json" },
      payload: {
        name: "Test User",
        email,
        password: "SecurePass123!",
        recaptchaToken: "tok-high",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith("tok-high", "register");
  });

  it("rejects password sign-in with RECAPTCHA_FAILED when score is below threshold", async () => {
    verifyMock.mockResolvedValueOnce({
      success: true,
      score: 0.1,
      action: "login",
      hostname: "test",
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "content-type": "application/json" },
      payload: {
        email: "anyone@example.com",
        password: "wrong",
        recaptchaToken: "tok-low",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("RECAPTCHA_FAILED");
  });

  it("rejects when verifyRecaptcha returns success=false", async () => {
    verifyMock.mockResolvedValueOnce({
      success: false,
      score: 0,
      action: "login",
      hostname: "",
      reason: "timeout-or-duplicate",
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "content-type": "application/json" },
      payload: {
        email: "anyone@example.com",
        password: "x",
        recaptchaToken: "tok-bad",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("RECAPTCHA_FAILED");
  });

  it("does not gate routes that aren't recaptcha-protected", async () => {
    // /get-session is not in the protected list — no token required and
    // the verifier should never be called.
    const res = await server.inject({
      method: "GET",
      url: "/api/auth/get-session",
    });

    // 200 with user: null when not signed in, depending on better-auth's
    // response shape — what matters is no 403/RECAPTCHA_FAILED.
    expect(res.statusCode).not.toBe(403);
    expect(verifyMock).not.toHaveBeenCalled();
  });
});

describe("Auth — magic-link delivery", () => {
  it("sends a magic-link email when the score is good", async () => {
    verifyMock.mockResolvedValueOnce({
      success: true,
      score: 0.9,
      action: "magic-link",
      hostname: "test",
    });

    const email = uniqueEmail();
    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/magic-link",
      headers: { "content-type": "application/json" },
      payload: { email, recaptchaToken: "tok-magic" },
    });

    expect(res.statusCode).toBe(200);
    expect(nullTransport.sent).toHaveLength(1);
    expect(nullTransport.sent[0]?.to).toBe(email);
    expect(nullTransport.sent[0]?.subject).toContain("Sign in to Reissulla");
    expect(nullTransport.sent[0]?.text).toContain("expires in 15 minutes");
  });

  it("blocks magic-link delivery on low score (caller falls back to nothing)", async () => {
    verifyMock.mockResolvedValueOnce({
      success: true,
      score: 0.2,
      action: "magic-link",
      hostname: "test",
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/magic-link",
      headers: { "content-type": "application/json" },
      payload: {
        email: uniqueEmail(),
        recaptchaToken: "tok-magic-low",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("RECAPTCHA_FAILED");
    expect(nullTransport.sent).toHaveLength(0);
  });
});
