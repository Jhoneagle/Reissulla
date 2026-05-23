import { useEffect, useState, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import en from "./messages-en.json";
import fi from "./messages-fi.json";

/**
 * i18n shell. Two locales: `fi` (Suomi) and `en` (English).
 *
 * Locale resolution order:
 * 1. `localStorage["reissulla:locale"]` if previously set (settings page
 *    writes here; preferences sync follows in commit 11).
 * 2. `navigator.language` if it starts with "fi" — Finnish-speaking
 *    browsers default to fi.
 * 3. Otherwise `en`.
 *
 * Catalogue files are imported as static JSON so unused keys are caught at
 * build time and bundle size is the union of the included locales.
 */

export type Locale = "fi" | "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["fi", "en"];

const CATALOGUES: Record<Locale, Record<string, string>> = { en, fi };
const STORAGE_KEY = "reissulla:locale";

export function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "fi" || stored === "en") return stored;
  if (window.navigator.language?.toLowerCase().startsWith("fi")) return "fi";
  return "en";
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

interface I18nShellProps {
  children: ReactNode;
}

export function I18nShell({ children }: I18nShellProps) {
  const [locale, setLocale] = useState<Locale>(() => resolveInitialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Settings page dispatches a custom event when the locale changes so the
  // whole tree re-renders with the new catalogue without a reload.
  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail === "fi" || detail === "en") setLocale(detail);
    }
    window.addEventListener(
      "reissulla:locale-change",
      onChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        "reissulla:locale-change",
        onChange as EventListener,
      );
    };
  }, []);

  return (
    <IntlProvider
      locale={locale}
      messages={CATALOGUES[locale]}
      defaultLocale="en"
    >
      {children}
    </IntlProvider>
  );
}

/**
 * Emit a locale change. The I18nShell listens and swaps catalogues in place,
 * and persists the choice to localStorage.
 */
export function changeLocale(locale: Locale): void {
  persistLocale(locale);
  window.dispatchEvent(
    new CustomEvent<Locale>("reissulla:locale-change", { detail: locale }),
  );
}
