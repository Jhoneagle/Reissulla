import { create } from "zustand";
import { authApi, type AuthUser } from "@reissulla/api-client";

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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
    const res = await authApi.signIn(email, password);
    set({ user: res.user });
  },

  signUp: async (name, email, password) => {
    const res = await authApi.signUp(name, email, password);
    set({ user: res.user });
  },

  signOut: async () => {
    await authApi.signOut();
    set({ user: null });
  },
}));
