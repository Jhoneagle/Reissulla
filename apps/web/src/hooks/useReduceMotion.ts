import { useEffect, useState } from "react";
import { usePreferences } from "./usePreferences";

export type ReduceMotionApp = "on" | "off" | "system";

export interface ReduceMotionState {
  /** OS-level `prefers-reduced-motion: reduce` value. */
  os: boolean;
  /** App-level preference. Defaults to `"system"` for anonymous users. */
  app: ReduceMotionApp;
  /**
   * Final answer: the app pref wins outright, and `"system"` falls back
   * to the OS query. Components that want a single bool wire to this.
   */
  effective: boolean;
}

/**
 * Unified reduce-motion gate. Combines the OS-level matchMedia query with
 * the app-level `preferences.reduceMotion` ("on" / "off" / "system") so a
 * component only has to import one hook to gate animations. The body
 * data-attribute set by `Settings.tsx` still drives CSS-level rules in
 * `global.css`; this hook is the JS-side mirror used to disable
 * setTimeout/requestAnimationFrame loops before they kick off.
 *
 * SSR-safe: `window` is checked before subscribing.
 */
export function useReduceMotion(): ReduceMotionState {
  const prefs = usePreferences().data;
  const app: ReduceMotionApp = prefs?.reduceMotion ?? "system";

  const [os, setOs] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setOs(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const effective = app === "on" || (app === "system" && os);
  return { os, app, effective };
}
