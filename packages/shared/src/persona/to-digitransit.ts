import type { Persona } from "../types/persona.js";

/**
 * Persona translated into Digitransit OTP2 `planConnection` preference args.
 *
 * Adapters merge this into their GraphQL variables. Every Digitransit-family
 * adapter (Finland, HSL, Waltti, Varely) consumes the same shape — a single
 * mapping function keeps the translation in one place.
 */
export interface DigitransitPersonaArgs {
  /** OTP2 `accessibility.wheelchair.enabled` — also covers noStairs. */
  wheelchair?: boolean;
  /**
   * Slower walking speed in m/s for stroller / low-vision users. Adapters
   * forward to `street.walk.speed`. 0.9 m/s is the OTP2 conservative default;
   * normal default is 1.34 m/s.
   */
  walkSpeedMetresPerSec?: number;
  /** True when the planner should bias toward fewer transfers — stroller users. */
  preferFewerTransfers?: boolean;
  /** True when stairs should be avoided. noStairs persona only. */
  avoidStairs?: boolean;
}

export function personaToPlanArgs(persona: Persona): DigitransitPersonaArgs {
  const args: DigitransitPersonaArgs = {};

  // `noStairs` implies wheelchair-accessible routing for OTP2 purposes;
  // both flags route to the same upstream preference.
  if (persona.wheelchair || persona.noStairs) {
    args.wheelchair = true;
  }
  if (persona.noStairs) {
    args.avoidStairs = true;
  }

  // Stroller: looser tolerance (OTP2 doesn't expose a stroller flag) — we
  // slow walking and prefer fewer transfers. Wheelchair is the harder
  // constraint and takes precedence when both flags are set.
  if (persona.stroller && !args.wheelchair) {
    args.walkSpeedMetresPerSec = 1.1;
    args.preferFewerTransfers = true;
  }

  return args;
}
