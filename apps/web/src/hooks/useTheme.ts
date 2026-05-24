import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { usePreferences } from "./usePreferences";

type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "reissulla:theme";

function resolveSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  return resolveSystem();
}

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

/**
 * Single source of truth for the user-selected colour theme. Reads
 * `preferences.theme` for authed users; falls back to localStorage for
 * anonymous ones. Writes the resolved value (`"light"` / `"dark"`,
 * never `"system"`) to `<html data-theme>` so CSS only needs one
 * selector per token block.
 *
 * When the preference is `"system"` the hook subscribes to the
 * `prefers-color-scheme: dark` media query so toggling OS dark mode
 * flips the page in real time. Authed users' preferences are also
 * mirrored into localStorage so the inline boot script in index.html
 * can pick up the right value on the next page load — no light-mode
 * flash before React mounts.
 */
export function useTheme(): void {
  const user = useAuthStore((s) => s.user);
  const prefs = usePreferences().data;
  const choice: ThemeChoice =
    (prefs?.theme as ThemeChoice) ?? readStoredChoice();

  // Mirror the authed preference to localStorage so the index.html
  // boot script can read it before React hydrates.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) return;
    if (!prefs?.theme) return;
    if (prefs.theme === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, prefs.theme);
    }
  }, [user, prefs?.theme]);

  // Apply the resolved theme on every change, and subscribe to OS
  // dark-mode toggles whenever the choice is "system".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      document.documentElement.setAttribute("data-theme", resolve(choice));
    };
    apply();
    if (choice !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [choice]);
}
