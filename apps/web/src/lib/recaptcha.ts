/**
 * Client-side reCAPTCHA v3 helper.
 *
 * - Loads grecaptcha lazily on first use (no script tag until the user actually
 *   tries to sign in / register).
 * - Returns an empty token when `VITE_RECAPTCHA_SITE_KEY` is unset, which
 *   pairs with the backend's "disabled passthrough" mode so dev environments
 *   without recaptcha credentials just work.
 * - Falls back to an empty token if grecaptcha fails to load (network blocked,
 *   ad-block, etc.) — the backend will then either accept it (disabled mode)
 *   or reject it with RECAPTCHA_FAILED, which the auth store turns into a
 *   magic-link fallback. Never blocks the auth attempt on a script-load error.
 */

const SITE_KEY: string = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? "";

export type RecaptchaAction = "login" | "register" | "magic-link";

interface GrecaptchaV3 {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: GrecaptchaV3;
  }
}

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-reissulla-recaptcha="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.dataset.reissullaRecaptcha = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    // Resolve (don't reject) on load failure — fall through to empty-token
    // path, which lets the magic-link fallback handle it from the BE side.
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function isRecaptchaEnabled(): boolean {
  return SITE_KEY !== "";
}

export async function executeRecaptcha(
  action: RecaptchaAction,
): Promise<string> {
  if (!SITE_KEY) return "";
  await loadScript();
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) return "";
  return new Promise<string>((resolve) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(SITE_KEY, { action })
        .then(resolve)
        .catch(() => resolve(""));
    });
  });
}
