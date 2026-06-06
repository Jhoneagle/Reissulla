import { describe, it, expect } from "vitest";
import { classifyRailHeadsign } from "../services/transit/rail-direction.js";

describe("classifyRailHeadsign", () => {
  it("maps southbound Helsinki termini", () => {
    expect(classifyRailHeadsign("Helsinki")).toEqual({
      bucket: "SOUTH",
      label: "ETELÄÄN ↓",
    });
    expect(classifyRailHeadsign("Helsingin päärautatieasema")).toEqual({
      bucket: "SOUTH",
      label: "ETELÄÄN ↓",
    });
  });

  it("maps northbound termini (Riihimäki, Tampere, Lahti, Kerava, Korso)", () => {
    expect(classifyRailHeadsign("Riihimäki").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Tampere").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Lahti").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Kerava").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Korso").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Tampere").label).toBe("POHJOISEEN ↑");
  });

  it("buckets western/coastal commuter endpoints as outbound (NORTH)", () => {
    expect(classifyRailHeadsign("Kirkkonummi").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Kauklahti").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Leppävaara").bucket).toBe("NORTH");
  });

  it("buckets long-haul east endpoints as outbound (NORTH)", () => {
    expect(classifyRailHeadsign("Kouvola").bucket).toBe("NORTH");
    expect(classifyRailHeadsign("Vainikkala").bucket).toBe("NORTH");
  });

  it("resolves a compound 'X via Y' headsign by its primary endpoint", () => {
    expect(classifyRailHeadsign("Korso via Malmi-Tikkurila").bucket).toBe(
      "NORTH",
    );
    expect(classifyRailHeadsign("Kirkkonummi via Leppävaara").bucket).toBe(
      "NORTH",
    );
  });

  it("maps the Lentoasema ring as a separate bucket", () => {
    expect(classifyRailHeadsign("Lentoasema")).toEqual({
      bucket: "RING",
      label: "KEHÄ ↻",
    });
  });

  it("falls back to OTHER with the raw headsign for unknown endpoints", () => {
    expect(classifyRailHeadsign("Ainola")).toEqual({
      bucket: "OTHER",
      label: "Ainola",
    });
  });

  it("trims surrounding whitespace on the input", () => {
    expect(classifyRailHeadsign("  Helsinki  ").bucket).toBe("SOUTH");
  });
});
