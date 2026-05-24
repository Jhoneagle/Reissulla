import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins/magic-link";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { config } from "../config.js";
import { getEmailTransport } from "../email/transport.js";
import { verifyRecaptcha, type RecaptchaAction } from "./recaptcha.js";

const MAGIC_LINK_EXPIRES_SECONDS = 60 * 15;

const RECAPTCHA_PROTECTED_PATHS: Record<string, RecaptchaAction> = {
  "/sign-in/email": "login",
  "/sign-up/email": "register",
  "/sign-in/magic-link": "magic-link",
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: config.authSecret,
  baseURL:
    config.nodeEnv === "production"
      ? process.env.BASE_URL
      : `http://localhost:${config.port}`,
  trustedOrigins: [config.frontendUrl],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      enabled: config.googleClientId !== "",
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_SECONDS,
      // sendMagicLink is invoked for every magic-link request — whether the
      // user explicitly asked for one OR the low-score recaptcha hook routed
      // them through here. Either way, deliver via the configured transport.
      sendMagicLink: async ({ email, url }) => {
        await getEmailTransport().send({
          to: email,
          subject: "Sign in to Reissulla",
          text:
            `Sign in by clicking the link below:\n\n${url}\n\n` +
            `The link expires in 15 minutes. If you didn't request this, ignore the email.`,
        });
      },
    }),
  ],
  hooks: {
    // reCAPTCHA gate for password and magic-link entry points. Verification
    // is per-token (cached) so a client retry of a single token doesn't burn
    // Google quota. Low score → throw with code RECAPTCHA_FAILED so the FE
    // can transparently fall back to the magic-link flow without ever
    // surfacing a challenge UI (accessibility decision in roadmap §3).
    before: createAuthMiddleware(async (ctx) => {
      const action = RECAPTCHA_PROTECTED_PATHS[ctx.path];
      if (!action) return;

      const body =
        (ctx.body as Record<string, unknown> | undefined) ?? undefined;
      const rawToken = body?.recaptchaToken;
      const token = typeof rawToken === "string" ? rawToken : "";

      const verification = await verifyRecaptcha(token, action);
      if (
        !verification.success ||
        verification.score < config.recaptchaThreshold
      ) {
        throw new APIError("FORBIDDEN", {
          code: "RECAPTCHA_FAILED",
          message:
            "Couldn't verify the sign-in attempt. Use the magic-link option below instead.",
        });
      }
    }),
  },
});
