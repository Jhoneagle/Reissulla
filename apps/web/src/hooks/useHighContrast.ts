import { useEffect, useState } from "react";
import { usePreferences } from "./usePreferences";

/**
 * Unified high-contrast gate. ORs the OS-level `prefers-contrast: more`
 * query with the app-level `preferences.highContrast` boolean so a
 * component only has to import one hook to decide whether to disable a
 * decorative overlay. CSS-level rules in `global.css` already handle
 * `body[data-high-contrast]` + the media query for the theme switch;
 * this hook is the JS-side mirror for components (e.g. RainRadarOverlay)
 * that need to skip rendering entirely under HC rather than just restyle.
 *
 * SSR-safe: `window` is checked before subscribing.
 */
export function useHighContrast(): boolean {
  const prefs = usePreferences().data;
  const app = prefs?.highContrast ?? false;

  const [os, setOs] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-contrast: more)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-contrast: more)");
    const handler = (e: MediaQueryListEvent) => setOs(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return app || os;
}
