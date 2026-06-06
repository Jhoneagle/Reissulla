import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_PERSONA, type Persona } from "@reissulla/shared";
import { digitransitFinland } from "../adapters/digitransit-finland/index.js";
import { digitransitHsl } from "../adapters/digitransit-hsl/index.js";
import { digitransitVarely } from "../adapters/digitransit-varely/index.js";
import { digitransitWaltti } from "../adapters/digitransit-waltti/index.js";
import type { DigitransitAdapter } from "../adapters/digitransit-routing/adapter.js";
import {
  getCapturedRequests,
  clearCapturedRequests,
  type CapturedRequest,
} from "../../test/msw/request-log.js";

/**
 * Mitigation for architecture §16 Risk #3 — persona forgotten in a new
 * adapter. Every Digitransit adapter must forward persona accessibility
 * flags into the upstream planConnection preferences. The matrix below
 * iterates over the full `DigitransitAdapterName` union so adding a fifth
 * adapter without persona plumbing fails this suite immediately.
 *
 * The closed-set MSW handler for digitransit-routing returns an empty
 * planConnection response and records every outgoing request in the
 * per-worker request log. Tests inspect that log to assert the
 * outgoing GraphQL query body — no per-test handler mutation needed.
 */
const ADAPTERS: DigitransitAdapter[] = [
  digitransitFinland,
  digitransitHsl,
  digitransitWaltti,
  digitransitVarely,
];

const WHEELCHAIR_PERSONA: Persona = { ...DEFAULT_PERSONA, wheelchair: true };

function ctxWith(persona: Persona) {
  return {
    signal: new AbortController().signal,
    locale: persona.language,
    persona,
  };
}

const PLAN_ARGS = {
  fromLat: 60.17,
  fromLon: 24.94,
  toLat: 60.2,
  toLon: 24.96,
  numItineraries: 1,
};

function lastPlanRequest(): CapturedRequest {
  const planRequests = getCapturedRequests().filter((r) => {
    if (!r.url.includes("routing/v2")) return false;
    const body = r.body as { query?: string } | null;
    return body?.query?.includes("planConnection") ?? false;
  });
  if (planRequests.length === 0) {
    throw new Error("No planConnection request was captured");
  }
  return planRequests.at(-1)!;
}

describe.each(ADAPTERS)("$name forwards persona accessibility", (adapter) => {
  beforeEach(() => {
    clearCapturedRequests();
  });

  it("emits the wheelchair preference when persona has wheelchair=true", async () => {
    await adapter.planConnection(PLAN_ARGS, ctxWith(WHEELCHAIR_PERSONA));

    const req = lastPlanRequest();
    const body = req.body as { query: string };
    expect(body.query).toContain("wheelchair: { enabled: true }");
  });

  it("omits the wheelchair preference for the default persona", async () => {
    await adapter.planConnection(PLAN_ARGS, ctxWith(DEFAULT_PERSONA));

    const req = lastPlanRequest();
    const body = req.body as { query: string };
    expect(body.query).not.toContain("wheelchair: { enabled: true }");
  });

  it("emits the wheelchair preference when persona has noStairs=true", async () => {
    await adapter.planConnection(
      PLAN_ARGS,
      ctxWith({ ...DEFAULT_PERSONA, noStairs: true }),
    );

    const req = lastPlanRequest();
    const body = req.body as { query: string };
    expect(body.query).toContain("wheelchair: { enabled: true }");
  });

  it("emits exactly one wheelchair preference when both wheelchair and noStairs are set", async () => {
    await adapter.planConnection(
      PLAN_ARGS,
      ctxWith({ ...DEFAULT_PERSONA, wheelchair: true, noStairs: true }),
    );

    const req = lastPlanRequest();
    const body = req.body as { query: string };
    const matches = body.query.match(/wheelchair: \{ enabled: true \}/g);
    expect(matches).toHaveLength(1);
  });

  it("omits the wheelchair preference for personas that don't imply step-free routing", async () => {
    // lowFloor / stroller / sr / lv don't translate into OTP2 wheelchair
    // preferences — they're FE rendering hints (vehicle filtering, audio
    // cues, contrast). The plan call must NOT degrade itineraries for
    // these riders.
    await adapter.planConnection(
      PLAN_ARGS,
      ctxWith({
        ...DEFAULT_PERSONA,
        lowFloor: true,
        stroller: true,
        screenReader: true,
        lowVision: true,
      }),
    );

    const req = lastPlanRequest();
    const body = req.body as { query: string };
    expect(body.query).not.toContain("wheelchair: { enabled: true }");
  });
});
