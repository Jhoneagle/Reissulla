import { describe, it, expect } from "vitest";
import type { TransitDeparture } from "@reissulla/shared";
import { clusterRailDirections } from "../services/transit/departures.service.js";

function dep(overrides: Partial<TransitDeparture>): TransitDeparture {
  return {
    routeShortName: "I",
    routeLongName: "Helsinki - Lentoasema - Helsinki",
    headsign: "Helsinki",
    scheduledArrival: 0,
    realtimeArrival: 0,
    arrivalDelay: 0,
    scheduledDeparture: 0,
    realtimeDeparture: 0,
    departureDelay: 0,
    realtime: false,
    serviceDay: 0,
    vehicleMode: "RAIL",
    ...overrides,
  };
}

describe("clusterRailDirections", () => {
  it("returns undefined for non-rail responses", () => {
    const deps = [
      dep({ vehicleMode: "BUS", headsign: "Helsinki" }),
      dep({ vehicleMode: "BUS", headsign: "Tampere" }),
      dep({ vehicleMode: "BUS", headsign: "Helsinki" }),
      dep({ vehicleMode: "BUS", headsign: "Tampere" }),
    ];
    expect(clusterRailDirections(deps)).toBeUndefined();
  });

  it("returns undefined below the minimum total", () => {
    const deps = [
      dep({ headsign: "Helsinki", directionId: "0" }),
      dep({ headsign: "Riihimäki", directionId: "1" }),
    ];
    expect(clusterRailDirections(deps)).toBeUndefined();
  });

  it("clusters by directionId when every trip carries one (HSL-only feed)", () => {
    const deps = [
      dep({ headsign: "Helsinki", directionId: "0" }),
      dep({ headsign: "Helsinki", directionId: "0" }),
      dep({ headsign: "Riihimäki", directionId: "1" }),
      dep({ headsign: "Riihimäki", directionId: "1" }),
    ];
    const result = clusterRailDirections(deps);
    expect(result).toBeDefined();
    expect(result!.a.departures).toHaveLength(2);
    expect(result!.b.departures).toHaveLength(2);
    expect(result!.other).toHaveLength(0);
  });

  it("falls back to semantic bucket clustering when directionId is missing", () => {
    const deps = [
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Tampere" }),
      dep({ headsign: "Tampere" }),
    ];
    const result = clusterRailDirections(deps);
    expect(result).toBeDefined();
    const labels = [result!.a.label, result!.b.label].sort();
    expect(labels).toEqual(["ETELÄÄN ↓", "POHJOISEEN ↑"]);
  });

  it("groups trips whose headsigns share a semantic bucket together", () => {
    const deps = [
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Riihimäki" }),
      dep({ headsign: "Tampere" }),
      dep({ headsign: "Kerava" }),
    ];
    // Three NORTH-bucket headsigns join one side; both Helsinki trips
    // join the SOUTH side. Top two buckets engage; no "other".
    const result = clusterRailDirections(deps);
    expect(result).toBeDefined();
    const allHelsinki = result!.a.departures.every(
      (d) => d.headsign === "Helsinki",
    )
      ? result!.a
      : result!.b;
    const northern = allHelsinki === result!.a ? result!.b : result!.a;
    expect(allHelsinki.departures).toHaveLength(2);
    expect(northern.departures).toHaveLength(3);
    expect(result!.other).toHaveLength(0);
  });

  it("places trips whose bucket isn't in the top two into 'other'", () => {
    const deps = [
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Riihimäki" }),
      dep({ headsign: "Tampere" }),
      dep({ headsign: "Ainola" }), // unknown — OTHER bucket
    ];
    const result = clusterRailDirections(deps);
    expect(result).toBeDefined();
    expect(result!.other).toHaveLength(1);
    expect(result!.other[0]!.headsign).toBe("Ainola");
  });

  it("falls through to bucket clustering when some trips lack directionId", () => {
    const deps = [
      dep({ headsign: "Helsinki", directionId: "0" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Riihimäki", directionId: "1" }),
      dep({ headsign: "Riihimäki" }),
    ];
    const result = clusterRailDirections(deps);
    expect(result).toBeDefined();
    // Mixed feed → bucket clustering, all 4 trips placed without "other"
    expect(result!.other).toHaveLength(0);
  });

  it("returns undefined when only one direction shows up", () => {
    const deps = [
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
      dep({ headsign: "Helsinki" }),
    ];
    // No second populated bucket — clustering should bow out.
    expect(clusterRailDirections(deps)).toBeUndefined();
  });
});
