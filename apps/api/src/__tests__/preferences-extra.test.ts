import { describe, it, expect } from "vitest";
import { DEFAULT_PERSONA } from "@reissulla/shared";
import { parseExtra } from "../db/repositories/preferences-extra.js";

describe("parseExtra", () => {
  it("returns empty object for null / non-object inputs", () => {
    expect(parseExtra(null)).toEqual({});
    expect(parseExtra(undefined)).toEqual({});
    expect(parseExtra("string")).toEqual({});
    expect(parseExtra(42)).toEqual({});
  });

  it("returns empty object for an empty object", () => {
    expect(parseExtra({})).toEqual({});
  });

  it("parses a well-formed persona", () => {
    const extra = parseExtra({
      persona: {
        wheelchair: true,
        lowFloor: false,
        noStairs: true,
        stroller: false,
        screenReader: true,
        lowVision: false,
        language: "fi",
      },
    });
    expect(extra.persona).toEqual({
      wheelchair: true,
      lowFloor: false,
      noStairs: true,
      stroller: false,
      screenReader: true,
      lowVision: false,
      language: "fi",
    });
  });

  it("defaults missing persona fields to safe values", () => {
    const extra = parseExtra({ persona: { wheelchair: true } });
    expect(extra.persona).toEqual({
      ...DEFAULT_PERSONA,
      wheelchair: true,
    });
  });

  it("defaults invalid language to en", () => {
    const extra = parseExtra({ persona: { language: "sv" } });
    expect(extra.persona?.language).toBe("en");
  });

  it("treats malformed persona values as false", () => {
    const extra = parseExtra({
      persona: { wheelchair: "yes", lowFloor: 1, noStairs: "true" },
    });
    expect(extra.persona?.wheelchair).toBe(false);
    expect(extra.persona?.lowFloor).toBe(false);
    expect(extra.persona?.noStairs).toBe(false);
  });

  it("preserves layerDefaults when it's an object", () => {
    const extra = parseExtra({
      layerDefaults: { transit: true, rain: false },
    });
    expect(extra.layerDefaults).toEqual({ transit: true, rain: false });
  });

  it("drops layerDefaults when it's not an object", () => {
    const extra = parseExtra({ layerDefaults: "not-an-object" });
    expect(extra.layerDefaults).toBeUndefined();
  });

  it("preserves persona and layerDefaults together", () => {
    const extra = parseExtra({
      persona: { wheelchair: true, language: "fi" },
      layerDefaults: { transit: true },
    });
    expect(extra.persona?.wheelchair).toBe(true);
    expect(extra.persona?.language).toBe("fi");
    expect(extra.layerDefaults).toEqual({ transit: true });
  });

  it("ignores unknown top-level keys — forward-compat", () => {
    const extra = parseExtra({
      persona: { wheelchair: true },
      futureField: { complex: "data" },
    });
    expect(extra).not.toHaveProperty("futureField");
    expect(extra.persona?.wheelchair).toBe(true);
  });

  it("round-trips personaBannerDismissed when set to true", () => {
    const extra = parseExtra({ personaBannerDismissed: true });
    expect(extra.personaBannerDismissed).toBe(true);
  });

  it("drops personaBannerDismissed when not strictly true", () => {
    expect(parseExtra({ personaBannerDismissed: false })).not.toHaveProperty(
      "personaBannerDismissed",
    );
    expect(parseExtra({ personaBannerDismissed: "true" })).not.toHaveProperty(
      "personaBannerDismissed",
    );
    expect(parseExtra({ personaBannerDismissed: 1 })).not.toHaveProperty(
      "personaBannerDismissed",
    );
  });
});
