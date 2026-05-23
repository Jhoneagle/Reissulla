import { create } from "zustand";
import { DEFAULT_PERSONA, type Persona } from "@reissulla/shared";

const STORAGE_KEY = "reissulla:persona";

interface PersonaStore {
  persona: Persona;
  set: (patch: Partial<Persona>) => void;
  replace: (persona: Persona) => void;
}

function loadFromStorage(): Persona {
  if (typeof window === "undefined") return { ...DEFAULT_PERSONA };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PERSONA };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null)
      return { ...DEFAULT_PERSONA };
    return { ...DEFAULT_PERSONA, ...(parsed as Partial<Persona>) };
  } catch {
    return { ...DEFAULT_PERSONA };
  }
}

function persist(persona: Persona): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persona));
}

/**
 * Local mirror of the user's persona. Synced to the server's
 * `preferences.extra.persona` for authenticated users (settings page
 * dispatches the PATCH); for anonymous users, localStorage is the source
 * of truth and the wire header `x-reissulla-persona` is built from this.
 */
export const usePersonaStore = create<PersonaStore>((set) => ({
  persona: loadFromStorage(),
  set: (patch) =>
    set((s) => {
      const next = { ...s.persona, ...patch };
      persist(next);
      return { persona: next };
    }),
  replace: (persona) => {
    persist(persona);
    set({ persona });
  },
}));
