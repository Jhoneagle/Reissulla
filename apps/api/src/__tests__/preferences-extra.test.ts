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

  it("parses a well-formed layerDefaults", () => {
    const extra = parseExtra({
      layerDefaults: {
        baseLayer: "tile-dark",
        overlays: ["overlay-stops", "overlay-warnings"],
      },
    });
    expect(extra.layerDefaults).toEqual({
      baseLayer: "tile-dark",
      overlays: ["overlay-stops", "overlay-warnings"],
    });
  });

  it("drops unknown LayerId values from overlays — forward compat", () => {
    const extra = parseExtra({
      layerDefaults: {
        baseLayer: "tile-streets",
        overlays: [
          "overlay-stops",
          "overlay-removed-in-future",
          "overlay-warnings",
        ],
      },
    });
    expect(extra.layerDefaults).toEqual({
      baseLayer: "tile-streets",
      overlays: ["overlay-stops", "overlay-warnings"],
    });
  });

  it("deduplicates repeated overlay entries", () => {
    const extra = parseExtra({
      layerDefaults: {
        baseLayer: "tile-streets",
        overlays: ["overlay-stops", "overlay-stops"],
      },
    });
    expect(extra.layerDefaults?.overlays).toEqual(["overlay-stops"]);
  });

  it("drops layerDefaults when baseLayer is missing or unknown", () => {
    expect(
      parseExtra({ layerDefaults: { overlays: [] } }).layerDefaults,
    ).toBeUndefined();
    expect(
      parseExtra({ layerDefaults: { baseLayer: "tile-removed", overlays: [] } })
        .layerDefaults,
    ).toBeUndefined();
  });

  it("drops layerDefaults when it's not an object", () => {
    const extra = parseExtra({ layerDefaults: "not-an-object" });
    expect(extra.layerDefaults).toBeUndefined();
  });

  it("falls back to empty overlays when array is malformed", () => {
    const extra = parseExtra({
      layerDefaults: { baseLayer: "tile-streets", overlays: "nope" },
    });
    expect(extra.layerDefaults).toEqual({
      baseLayer: "tile-streets",
      overlays: [],
    });
  });

  it("preserves persona and layerDefaults together", () => {
    const extra = parseExtra({
      persona: { wheelchair: true, language: "fi" },
      layerDefaults: { baseLayer: "tile-hc", overlays: ["overlay-warnings"] },
    });
    expect(extra.persona?.wheelchair).toBe(true);
    expect(extra.persona?.language).toBe("fi");
    expect(extra.layerDefaults).toEqual({
      baseLayer: "tile-hc",
      overlays: ["overlay-warnings"],
    });
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

  it("parses a well-formed liveRegion", () => {
    const extra = parseExtra({
      liveRegion: { verbosity: "verbose", readingPace: "slow" },
    });
    expect(extra.liveRegion).toEqual({
      verbosity: "verbose",
      readingPace: "slow",
    });
  });

  it("defaults invalid liveRegion members to the defaults", () => {
    const extra = parseExtra({
      liveRegion: { verbosity: "loud", readingPace: 5 },
    });
    expect(extra.liveRegion).toEqual({
      verbosity: "standard",
      readingPace: "normal",
    });
  });

  it("fills the missing liveRegion member when only one is set", () => {
    const extra = parseExtra({ liveRegion: { verbosity: "terse" } });
    expect(extra.liveRegion).toEqual({
      verbosity: "terse",
      readingPace: "normal",
    });
  });

  it("drops liveRegion when it's not an object", () => {
    expect(parseExtra({ liveRegion: "nope" }).liveRegion).toBeUndefined();
  });

  it("keeps an in-range historyRetentionDays", () => {
    expect(parseExtra({ historyRetentionDays: 30 }).historyRetentionDays).toBe(
      30,
    );
  });

  it("clamps historyRetentionDays above the max to 365", () => {
    expect(
      parseExtra({ historyRetentionDays: 99999 }).historyRetentionDays,
    ).toBe(365);
  });

  it("clamps historyRetentionDays below the min to 7", () => {
    expect(parseExtra({ historyRetentionDays: 1 }).historyRetentionDays).toBe(
      7,
    );
  });

  it("rounds a fractional historyRetentionDays", () => {
    expect(
      parseExtra({ historyRetentionDays: 90.7 }).historyRetentionDays,
    ).toBe(91);
  });

  it("drops a non-number historyRetentionDays — consumer applies default", () => {
    expect(parseExtra({ historyRetentionDays: "90" })).not.toHaveProperty(
      "historyRetentionDays",
    );
    expect(parseExtra({ historyRetentionDays: Infinity })).not.toHaveProperty(
      "historyRetentionDays",
    );
    expect(parseExtra({ historyRetentionDays: NaN })).not.toHaveProperty(
      "historyRetentionDays",
    );
  });
});
