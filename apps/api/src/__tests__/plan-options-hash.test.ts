import { describe, it, expect } from "vitest";
import { DEFAULT_PLAN_PREFERENCES } from "@reissulla/shared";
import { optionsHash } from "../services/transit/trip.service.js";

describe("optionsHash", () => {
  const base = {
    arriveBy: false,
    dateTime: undefined,
    modes: ["BUS", "RAIL"],
    planPreferences: DEFAULT_PLAN_PREFERENCES,
    preference: "fastest" as const,
  };

  it("is stable across equivalent option objects", () => {
    expect(optionsHash(base, 3)).toBe(optionsHash({ ...base }, 3));
  });

  it("ignores mode array order", () => {
    expect(optionsHash({ ...base, modes: ["BUS", "RAIL"] }, 3)).toBe(
      optionsHash({ ...base, modes: ["RAIL", "BUS"] }, 3),
    );
  });

  it("changes when preference flips", () => {
    expect(optionsHash(base, 3)).not.toBe(
      optionsHash({ ...base, preference: "fewest-transfers" }, 3),
    );
  });

  it("changes when arriveBy flips", () => {
    expect(optionsHash(base, 3)).not.toBe(
      optionsHash({ ...base, arriveBy: true }, 3),
    );
  });

  it("changes when numItineraries changes", () => {
    expect(optionsHash(base, 3)).not.toBe(optionsHash(base, 5));
  });

  it("changes when walkingSpeed changes", () => {
    expect(optionsHash(base, 3)).not.toBe(
      optionsHash(
        {
          ...base,
          planPreferences: {
            ...DEFAULT_PLAN_PREFERENCES,
            walkingSpeed: "fast",
          },
        },
        3,
      ),
    );
  });
});
