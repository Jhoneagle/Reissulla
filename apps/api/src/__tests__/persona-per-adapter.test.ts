import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_PERSONA, type Persona } from "@reissulla/shared";
import { digitransitFinland } from "../adapters/digitransit-finland/index.js";
import { digitransitHsl } from "../adapters/digitransit-hsl/index.js";
import { digitransitVarely } from "../adapters/digitransit-varely/index.js";
import { digitransitWaltti } from "../adapters/digitransit-waltti/index.js";
import type { DigitransitAdapter } from "../adapters/digitransit-routing/adapter.js";

/**
 * Mitigation for architecture §16 Risk #3 — persona forgotten in a new
 * adapter. Every Digitransit adapter must forward persona accessibility
 * flags into the upstream planConnection preferences. The matrix below
 * iterates over the full `DigitransitAdapterName` union so adding a fifth
 * adapter without persona plumbing fails this suite immediately.
 */
const ADAPTERS: DigitransitAdapter[] = [
  digitransitFinland,
  digitransitHsl,
  digitransitWaltti,
  digitransitVarely,
];

const WHEELCHAIR_PERSONA: Persona = { ...DEFAULT_PERSONA, wheelchair: true };

const EMPTY_PLAN_RESPONSE = {
  data: { planConnection: { edges: [] } },
};

function ctxWith(persona: Persona) {
  return { signal: new AbortController().signal, persona };
}

const PLAN_ARGS = {
  fromLat: 60.17,
  fromLon: 24.94,
  toLat: 60.2,
  toLon: 24.96,
  numItineraries: 1,
};

describe.each(ADAPTERS)("$name forwards persona accessibility", (adapter) => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emits the wheelchair preference when persona has wheelchair=true", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(EMPTY_PLAN_RESPONSE), { status: 200 }),
      );

    await adapter.planConnection(PLAN_ARGS, ctxWith(WHEELCHAIR_PERSONA));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestInit = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as { query: string };
    expect(body.query).toContain("wheelchair: { enabled: true }");
  });

  it("omits the wheelchair preference for the default persona", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(EMPTY_PLAN_RESPONSE), { status: 200 }),
      );

    await adapter.planConnection(PLAN_ARGS, ctxWith(DEFAULT_PERSONA));

    const requestInit = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as { query: string };
    expect(body.query).not.toContain("wheelchair: { enabled: true }");
  });

  it("emits the wheelchair preference when persona has noStairs=true", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(EMPTY_PLAN_RESPONSE), { status: 200 }),
      );

    await adapter.planConnection(
      PLAN_ARGS,
      ctxWith({ ...DEFAULT_PERSONA, noStairs: true }),
    );

    const requestInit = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as { query: string };
    expect(body.query).toContain("wheelchair: { enabled: true }");
  });
});
