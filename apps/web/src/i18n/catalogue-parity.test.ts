import { describe, it, expect } from "vitest";
import en from "./messages-en.json";
import fi from "./messages-fi.json";

/**
 * Translation coverage gate. Every message id in either catalogue must
 * exist in the other. A missing key in production would fall back to the
 * default-locale (en) string and silently ship a mixed-language UI — this
 * test makes that impossible without it failing CI first.
 */

const enKeys = new Set(Object.keys(en));
const fiKeys = new Set(Object.keys(fi));

function missing(from: Set<string>, against: Set<string>): string[] {
  const out: string[] = [];
  for (const k of against) if (!from.has(k)) out.push(k);
  out.sort();
  return out;
}

describe("i18n catalogue parity", () => {
  it("every fi key has an en translation", () => {
    expect(missing(enKeys, fiKeys)).toEqual([]);
  });

  it("every en key has a fi translation", () => {
    expect(missing(fiKeys, enKeys)).toEqual([]);
  });

  it("no empty values in either catalogue", () => {
    const blanks: Array<{ locale: "fi" | "en"; key: string }> = [];
    for (const [k, v] of Object.entries(en)) {
      if (typeof v !== "string" || v.trim() === "") {
        blanks.push({ locale: "en", key: k });
      }
    }
    for (const [k, v] of Object.entries(fi)) {
      if (typeof v !== "string" || v.trim() === "") {
        blanks.push({ locale: "fi", key: k });
      }
    }
    expect(blanks).toEqual([]);
  });
});
