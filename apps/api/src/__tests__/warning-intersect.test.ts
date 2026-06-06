import { describe, it, expect } from "vitest";
import { isPointInsidePolygon } from "../services/weather/warning-intersect.js";
import type { GeoJsonPolygon } from "../adapters/fmi/types.js";

const helsinkiPolygon: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [24.8, 60.1],
      [25.2, 60.1],
      [25.2, 60.4],
      [24.8, 60.4],
      [24.8, 60.1],
    ],
  ],
};

describe("isPointInsidePolygon", () => {
  it("recognises a point inside the ring", () => {
    expect(isPointInsidePolygon(60.17, 24.94, helsinkiPolygon)).toBe(true);
  });

  it("rejects a point outside the ring", () => {
    expect(isPointInsidePolygon(61.5, 23.5, helsinkiPolygon)).toBe(false);
  });

  it("rejects a point south of the ring", () => {
    expect(isPointInsidePolygon(60.05, 25.0, helsinkiPolygon)).toBe(false);
  });

  it("supports multi-ring polygons (any ring counts as match)", () => {
    const multi: GeoJsonPolygon = {
      type: "Polygon",
      coordinates: [
        helsinkiPolygon.coordinates[0]!,
        [
          [10.0, 50.0],
          [10.5, 50.0],
          [10.5, 50.5],
          [10.0, 50.5],
          [10.0, 50.0],
        ],
      ],
    };
    expect(isPointInsidePolygon(50.25, 10.25, multi)).toBe(true);
    expect(isPointInsidePolygon(60.17, 24.94, multi)).toBe(true);
  });
});
