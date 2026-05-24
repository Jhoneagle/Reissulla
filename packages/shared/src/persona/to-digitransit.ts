import type { Persona } from "../types/persona.js";

/**
 * Persona translated into Digitransit OTP2 `planConnection` preference args.
 *
 * Adapters merge this into their GraphQL variables. Every Digitransit-family
 * adapter (Finland, HSL, Waltti in Phase 2, Varely in Phase 2) consumes the
 * same shape — a single mapping function keeps the translation in one place.
 *
 * Phase 1 covers wheelchair routing. Phase 2 will extend with stroller walk
 * preferences and mode-boost hints when those features ship.
 */
export interface DigitransitPersonaArgs {
  wheelchair?: boolean;
}

export function personaToPlanArgs(persona: Persona): DigitransitPersonaArgs {
  const args: DigitransitPersonaArgs = {};

  // `noStairs` implies wheelchair-accessible routing for OTP2 purposes;
  // both flags route to the same upstream preference.
  if (persona.wheelchair || persona.noStairs) {
    args.wheelchair = true;
  }

  return args;
}
