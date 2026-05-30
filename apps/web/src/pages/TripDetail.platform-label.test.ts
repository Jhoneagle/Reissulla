import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import enMessages from "../i18n/messages-en.json";
import fiMessages from "../i18n/messages-fi.json";

function format(
  locale: "fi" | "en",
  values: { code: string; mode: string },
): string {
  const messages = locale === "fi" ? fiMessages : enMessages;
  const pattern = messages["transit.trip.platform"];
  return new IntlMessageFormat(pattern, locale).format(values) as string;
}

describe("transit.trip.platform (FI mode-aware select)", () => {
  it.each([
    ["rail", "raide 3"],
    ["subway", "raide 3"],
    ["bus", "laituri 3"],
    ["tram", "laituri 3"],
    ["ferry", "laituri 3"],
  ])("FI resolves mode=%s to '%s'", (mode, expected) => {
    expect(format("fi", { code: "3", mode })).toBe(expected);
  });

  it("FI falls back to 'laituri' for unknown modes", () => {
    expect(format("fi", { code: "B", mode: "unknown" })).toBe("laituri B");
  });
});

describe("transit.trip.platform (EN universal)", () => {
  it.each([
    ["rail", "platform 3"],
    ["subway", "platform 3"],
    ["bus", "platform 3"],
    ["tram", "platform 3"],
    ["ferry", "platform 3"],
  ])(
    "EN renders 'platform {code}' regardless of mode (mode=%s)",
    (mode, expected) => {
      expect(format("en", { code: "3", mode })).toBe(expected);
    },
  );
});
