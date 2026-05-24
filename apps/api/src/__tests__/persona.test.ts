import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERSONA,
  serializePersona,
  parsePersona,
  personaToPlanArgs,
  type Persona,
} from "@reissulla/shared";

describe("serializePersona", () => {
  it("emits all known fields in stable order", () => {
    expect(serializePersona(DEFAULT_PERSONA)).toBe(
      "wheelchair=0;lowFloor=0;noStairs=0;stroller=0;sr=0;lv=0;lang=en",
    );
  });

  it("encodes booleans as 1 / 0 and language verbatim", () => {
    const persona: Persona = {
      wheelchair: true,
      lowFloor: true,
      noStairs: false,
      stroller: false,
      screenReader: false,
      lowVision: true,
      language: "fi",
    };
    expect(serializePersona(persona)).toBe(
      "wheelchair=1;lowFloor=1;noStairs=0;stroller=0;sr=0;lv=1;lang=fi",
    );
  });

  it("is deterministic so it can double as a cache-key fingerprint", () => {
    const a: Persona = { ...DEFAULT_PERSONA, wheelchair: true };
    const b: Persona = { ...DEFAULT_PERSONA, wheelchair: true };
    expect(serializePersona(a)).toBe(serializePersona(b));
  });
});

describe("parsePersona", () => {
  it("returns the default persona for empty / undefined headers", () => {
    expect(parsePersona(undefined)).toEqual(DEFAULT_PERSONA);
    expect(parsePersona(null)).toEqual(DEFAULT_PERSONA);
    expect(parsePersona("")).toEqual(DEFAULT_PERSONA);
  });

  it("round-trips through serializePersona", () => {
    const persona: Persona = {
      wheelchair: true,
      lowFloor: false,
      noStairs: true,
      stroller: false,
      screenReader: true,
      lowVision: false,
      language: "fi",
    };
    expect(parsePersona(serializePersona(persona))).toEqual(persona);
  });

  it("tolerates whitespace around tokens", () => {
    const persona = parsePersona(
      " wheelchair=1 ;  sr=1  ;lang=fi ;noStairs=0 ",
    );
    expect(persona.wheelchair).toBe(true);
    expect(persona.screenReader).toBe(true);
    expect(persona.language).toBe("fi");
    expect(persona.noStairs).toBe(false);
  });

  it("ignores unknown fields rather than throwing — forward-compat", () => {
    const persona = parsePersona(
      "wheelchair=1;futureFlag=1;lang=en;another=value",
    );
    expect(persona.wheelchair).toBe(true);
    expect(persona.language).toBe("en");
  });

  it("treats malformed boolean values as false", () => {
    const persona = parsePersona("wheelchair=yes;sr=true;lowFloor=1");
    expect(persona.wheelchair).toBe(false);
    expect(persona.screenReader).toBe(false);
    expect(persona.lowFloor).toBe(true);
  });

  it("falls back to default language when lang value is unrecognised", () => {
    expect(parsePersona("lang=sv").language).toBe("en");
    expect(parsePersona("lang=").language).toBe("en");
  });

  it("missing boolean fields default to false", () => {
    const persona = parsePersona("wheelchair=1");
    expect(persona.wheelchair).toBe(true);
    expect(persona.lowFloor).toBe(false);
    expect(persona.noStairs).toBe(false);
    expect(persona.stroller).toBe(false);
    expect(persona.screenReader).toBe(false);
    expect(persona.lowVision).toBe(false);
  });
});

describe("personaToPlanArgs", () => {
  it("emits no args for the default persona", () => {
    expect(personaToPlanArgs(DEFAULT_PERSONA)).toEqual({});
  });

  it("maps wheelchair=true to wheelchair routing", () => {
    expect(personaToPlanArgs({ ...DEFAULT_PERSONA, wheelchair: true })).toEqual(
      { wheelchair: true },
    );
  });

  it("maps noStairs=true to wheelchair routing (same OTP2 preference)", () => {
    expect(personaToPlanArgs({ ...DEFAULT_PERSONA, noStairs: true })).toEqual({
      wheelchair: true,
    });
  });

  it("does not surface unrelated flags as routing args", () => {
    expect(
      personaToPlanArgs({
        ...DEFAULT_PERSONA,
        screenReader: true,
        lowVision: true,
        stroller: true,
        language: "fi",
      }),
    ).toEqual({});
  });
});
