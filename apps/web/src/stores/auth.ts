import { create } from "zustand";
import { ApiError, authApi, type AuthUser } from "@reissulla/api-client";
import { executeRecaptcha } from "../lib/recaptcha";

export type AuthOutcome =
  | { status: "signed-in" }
  | { status: "magic-link-sent"; email: string };

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthOutcome>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthOutcome>;
  requestMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Re-request a fresh recaptcha token and dispatch the magic-link endpoint.
 * Used both by the explicit "sign in via email" flow and by the silent
 * fallback when password sign-in returns RECAPTCHA_FAILED.
 */
async function sendMagicLink(email: string): Promise<void> {
  const token = await executeRecaptcha("magic-link");
  await authApi.requestMagicLink(email, token);
}

/** Treat RECAPTCHA_FAILED from any auth route as a signal to send magic-link instead. */
async function fallBackToMagicLinkIfNeeded(
  err: unknown,
  email: string,
): Promise<AuthOutcome> {
  if (err instanceof ApiError && err.code === "RECAPTCHA_FAILED") {
    await sendMagicLink(email);
    return { status: "magic-link-sent", email };
  }
  throw err;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    try {
      const res = await authApi.getSession();
      set({ user: res.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  signIn: async (email, password) => {
    const token = await executeRecaptcha("login");
    try {
      const res = await authApi.signIn(email, password, token);
      set({ user: res.user });
      return { status: "signed-in" };
    } catch (err) {
      return fallBackToMagicLinkIfNeeded(err, email);
    }
  },

  signUp: async (name, email, password) => {
    const token = await executeRecaptcha("register");
    try {
      const res = await authApi.signUp(name, email, password, token);
      set({ user: res.user });
      return { status: "signed-in" };
    } catch (err) {
      return fallBackToMagicLinkIfNeeded(err, email);
    }
  },

  requestMagicLink: async (email) => {
    await sendMagicLink(email);
  },

  signOut: async () => {
    await authApi.signOut();
    set({ user: null });
  },
}));
