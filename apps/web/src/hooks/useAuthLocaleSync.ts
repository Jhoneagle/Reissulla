import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { usePreferences } from "./usePreferences";
import { changeLocale, type Locale } from "../i18n";

/**
 * Reconcile the locale source-of-truth on auth state change.
 *
 * Anonymous users read locale from localStorage (managed by the i18n
 * shell). Authenticated users have a server-side `preferences.language`
 * that should take precedence — without sync, you can land in a state
 * where the app renders in Finnish (from localStorage) but the Settings
 * combobox shows English (from server prefs), and changing language in
 * Settings only PATCHes the server while the page stays as-was.
 *
 * Strategy: whenever an authed user's server-side `prefs.language`
 * differs from `localStorage["reissulla:locale"]`, dispatch the
 * standard `changeLocale` call. `changeLocale` mirrors the value into
 * localStorage and fires the locale-change event the i18n shell
 * listens to, so the whole tree re-renders with the new catalogue.
 *
 * Loop-free: `changeLocale` doesn't write back to server prefs from
 * here, so it can't trigger another sync iteration.
 */
export function useAuthLocaleSync(): void {
  const user = useAuthStore((s) => s.user);
  const prefs = usePreferences().data;
  const serverLanguage = prefs?.language;

  useEffect(() => {
    if (!user || !serverLanguage) return;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("reissulla:locale");
    if (stored !== serverLanguage) {
      changeLocale(serverLanguage as Locale);
    }
  }, [user, serverLanguage]);
}
