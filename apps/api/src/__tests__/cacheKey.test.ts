import { describe, it, expect } from "vitest";
import { cacheKey } from "../cache/key.js";

describe("cacheKey", () => {
  it("returns domain:entity:vN when no segments are passed", () => {
    expect(cacheKey("weather", "current", 1)).toBe("weather:current:v1");
  });

  it("appends string segments separated by colons", () => {
    expect(cacheKey("weather", "current", 1, "60.17", "24.94")).toBe(
      "weather:current:v1:60.17:24.94",
    );
  });

  it("stringifies numeric segments", () => {
    expect(
      cacheKey("transit", "stops-nearby", 1, "60.170", "24.940", 500),
    ).toBe("transit:stops-nearby:v1:60.170:24.940:500");
  });

  it("stringifies boolean segments", () => {
    expect(cacheKey("transit", "departures", 1, "HSL:1040602", 20, false)).toBe(
      "transit:departures:v1:HSL:1040602:20:false",
    );
  });

  it("bumping version produces a distinct key", () => {
    const v1 = cacheKey("transit", "plan", 1, "60.170", "24.940");
    const v2 = cacheKey("transit", "plan", 2, "60.170", "24.940");
    expect(v1).not.toEqual(v2);
    expect(v2).toBe("transit:plan:v2:60.170:24.940");
  });
});
