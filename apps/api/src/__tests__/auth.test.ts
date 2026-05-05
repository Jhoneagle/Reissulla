import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../app.js";
import { redis } from "../cache/redis.js";
import { db } from "../db/index.js";
import { user, session, account } from "../db/schema.js";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const TEST_EMAIL_DOMAIN = "@test.reissulla.local";
const createdEmails: string[] = [];

const uniqueEmail = () => {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}${TEST_EMAIL_DOMAIN}`;
  createdEmails.push(email);
  return email;
};

let server: FastifyInstance;

beforeAll(async () => {
  await redis.connect();
  server = await buildServer();
});

afterAll(async () => {
  // Only delete users created by this test run — FK cascades handle session/account
  if (createdEmails.length > 0) {
    // Find user IDs for our test emails
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

describe("Auth - Registration and Login", () => {
  const testEmail = uniqueEmail();
  const testUser = {
    name: "Test User",
    email: testEmail,
    password: "SecurePass123!",
  };

  it("registers a new user via /api/auth/sign-up/email", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "content-type": "application/json" },
      payload: testUser,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testUser.email);
    expect(body.user.name).toBe(testUser.name);
  });

  it("rejects duplicate registration", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "content-type": "application/json" },
      payload: testUser,
    });

    expect(response.statusCode).not.toBe(200);
  });

  it("logs in with valid credentials", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "content-type": "application/json" },
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testUser.email);
  });

  it("rejects login with wrong password", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "content-type": "application/json" },
      payload: {
        email: testUser.email,
        password: "WrongPassword123!",
      },
    });

    expect(response.statusCode).not.toBe(200);
  });
});

describe("Auth - Protected routes", () => {
  it("returns 401 for unauthenticated request to /api/v1/me", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/me",
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns user data when authenticated", async () => {
    const email = uniqueEmail();

    const signUpResponse = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "content-type": "application/json" },
      payload: {
        name: "Auth Test",
        email,
        password: "SecurePass123!",
      },
    });

    const setCookie = signUpResponse.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const cookieHeader = cookies
      .filter(Boolean)
      .map((c) => (c as string).split(";")[0])
      .join("; ");

    const meResponse = await server.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: cookieHeader },
    });

    expect(meResponse.statusCode).toBe(200);
    const body = meResponse.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(email);
  });
});
