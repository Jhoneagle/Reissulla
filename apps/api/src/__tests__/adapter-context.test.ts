import { describe, expect, it } from "vitest";
import { DEFAULT_PERSONA, type Persona } from "@reissulla/shared";
import {
  localeFromPersona,
  type AdapterContext,
  type AdapterLocale,
} from "../adapters/types.js";

describe("AdapterContext locale", () => {
  it("derives 'fi' from a fi-language persona", () => {
    const persona: Persona = { ...DEFAULT_PERSONA, language: "fi" };
    expect(localeFromPersona(persona)).toBe("fi");
  });

  it("derives 'en' from an en-language persona", () => {
    const persona: Persona = { ...DEFAULT_PERSONA, language: "en" };
    expect(localeFromPersona(persona)).toBe("en");
  });

  // Reissulla is Helsinki-transit first; an undefined persona at an adapter
  // call site falls back to fi rather than en so anonymous requests with no
  // explicit signal don't get an English-only surface by default.
  it("falls back to 'fi' when persona is undefined", () => {
    expect(localeFromPersona(undefined)).toBe("fi");
  });

  it("accepts the literal locale union on AdapterContext", () => {
    const locales: AdapterLocale[] = ["fi", "en"];
    for (const locale of locales) {
      const ctx: AdapterContext = {
        signal: new AbortController().signal,
        locale,
      };
      expect(ctx.locale).toBe(locale);
    }
  });
});
