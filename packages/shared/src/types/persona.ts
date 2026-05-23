/**
 * Accessibility + language flags carried with every request that should be
 * persona-aware. Anonymous users carry this in localStorage; authenticated
 * users carry it in `preferences.extra.persona` and on the wire via the
 * `x-reissulla-persona` header.
 *
 * Phase 1 introduces the type and threads it through transit adapter calls.
 * Later phases consume it for line search, fares, alerts, etc.
 */
export interface Persona {
  /** Wheelchair-accessible routing (boards low-floor vehicles, avoids stairs). */
  wheelchair: boolean;
  /** Prefer low-floor vehicles when otherwise equivalent. */
  lowFloor: boolean;
  /** Avoid routes that require stairs. Implies wheelchair for routing. */
  noStairs: boolean;
  /** Slower walking speed and reduced transfer reluctance for stroller users. */
  stroller: boolean;
  /** Screen-reader user — affects list-first rendering and ARIA verbosity. */
  screenReader: boolean;
  /** Low-vision user — affects high-contrast tokens and font scale defaults. */
  lowVision: boolean;
  /** UI language. Authoritative source for auth'd users is `preferences.language`. */
  language: "fi" | "en";
}

export const DEFAULT_PERSONA: Persona = {
  wheelchair: false,
  lowFloor: false,
  noStairs: false,
  stroller: false,
  screenReader: false,
  lowVision: false,
  language: "en",
};

export const PERSONA_HEADER = "x-reissulla-persona";
