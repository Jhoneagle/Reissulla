import { describe, it, expect } from "vitest";
import { createIntl } from "react-intl";
import en from "./messages-en.json";
import fi from "./messages-fi.json";

const TEMPLATE_KEYS = [
  "liveAnnouncer.terse",
  "liveAnnouncer.standard",
  "liveAnnouncer.verbose",
  "liveAnnouncer.combined",
  "liveAnnouncer.eta.now",
  "liveAnnouncer.eta.aboutMinute",
  "liveAnnouncer.eta.minutes",
] as const;

describe("live-region announcement templates", () => {
  it("every template exists in both catalogues", () => {
    const enKeys = Object.keys(en);
    const fiKeys = Object.keys(fi);
    for (const key of TEMPLATE_KEYS) {
      expect(enKeys).toContain(key);
      expect(fiKeys).toContain(key);
    }
  });

  it("terse carries the route only — no stop, no headsign", () => {
    const intl = createIntl({ locale: "en", messages: en });
    const out = intl.formatMessage(
      { id: "liveAnnouncer.terse" },
      { route: "14" },
    );
    expect(out).toContain("14");
    expect(out).not.toContain("Rautatientori");
  });

  it("standard carries route + stop", () => {
    const intl = createIntl({ locale: "en", messages: en });
    const out = intl.formatMessage(
      { id: "liveAnnouncer.standard" },
      { route: "14", stop: "Rautatientori" },
    );
    expect(out).toContain("14");
    expect(out).toContain("Rautatientori");
  });

  it("verbose carries route + headsign + stop + eta", () => {
    const intl = createIntl({ locale: "en", messages: en });
    const out = intl.formatMessage(
      { id: "liveAnnouncer.verbose" },
      {
        route: "14",
        headsign: "Munkkivuori",
        stop: "Rautatientori",
        eta: "now",
      },
    );
    expect(out).toContain("14");
    expect(out).toContain("Munkkivuori");
    expect(out).toContain("Rautatientori");
    expect(out).toContain("now");
  });

  it("uses no arrow glyph in any template (screen readers read it literally)", () => {
    for (const messages of [en, fi] as Record<string, string>[]) {
      for (const key of TEMPLATE_KEYS) {
        expect(messages[key]).not.toContain("→");
      }
    }
  });
});
