import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { config } from "../config.js";

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
});
