import { useEffect, useState } from "react";
import { usePreferences } from "./usePreferences";

/**
 * Unified high-contrast gate. ORs three signals:
 *
 *   - OS-level `prefers-contrast: more` query
 *   - app-level `preferences.highContrast` boolean (signed-in users)
 *   - `body[data-high-contrast="true"]` attribute (the live attribute
 *     `Settings.tsx` writes; covers the moment between toggle and
 *     prefs-query revalidation, plus anonymous toggles for QA harnesses)
 *
 * Subscribes to all three so a component (e.g. `RainRadarOverlay`) that
 * needs to short-circuit rendering under HC reacts within a frame.
 *
 * SSR-safe: `window` / `document` are checked before subscribing.
 */
export function useHighContrast(): boolean {
  const prefs = usePreferences().data;
  const app = prefs?.highContrast ?? false;

  const [os, setOs] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-contrast: more)").matches;
  });

  const [bodyAttr, setBodyAttr] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.body.dataset.highContrast === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-contrast: more)");
    const handler = (e: MediaQueryListEvent) => setOs(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const target = document.body;
    const observer = new MutationObserver(() => {
      setBodyAttr(target.dataset.highContrast === "true");
    });
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["data-high-contrast"],
    });
    return () => observer.disconnect();
  }, []);

  return app || os || bodyAttr;
}
