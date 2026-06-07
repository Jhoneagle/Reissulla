import { describe, it, expect } from "vitest";
import type { TransitDeparture } from "@reissulla/shared";
import { diffDepartures } from "../services/realtime/channels/stop-departures-diff.js";

function makeRow(overrides: Partial<TransitDeparture> = {}): TransitDeparture {
  return {
    routeShortName: "550",
    routeLongName: "Itäkeskus(M)–Westendinasema",
    headsign: "Westendinasema",
    scheduledArrival: 36000,
    realtimeArrival: 36000,
    arrivalDelay: 0,
    scheduledDeparture: 36000,
    realtimeDeparture: 36000,
    departureDelay: 0,
    realtime: true,
    serviceDay: 1_730_000_000,
    vehicleMode: "BUS",
    tripId: "HSL:1550_20251023_Ti_2_0807",
    ...overrides,
  };
}

describe("diffDepartures", () => {
  it("returns next in full when prev is null (first poll seeds the snapshot)", () => {
    const next = [makeRow(), makeRow({ tripId: "HSL:trip-b" })];
    expect(diffDepartures(null, next)).toEqual(next);
  });

  it("returns no rows when prev and next are identical", () => {
    const prev = [makeRow(), makeRow({ tripId: "HSL:trip-b" })];
    const next = [makeRow(), makeRow({ tripId: "HSL:trip-b" })];
    expect(diffDepartures(prev, next)).toEqual([]);
  });

  it("emits only the row whose realtime-only fields changed", () => {
    const prev = [
      makeRow({ tripId: "HSL:trip-a", departureDelay: 0 }),
      makeRow({ tripId: "HSL:trip-b", departureDelay: 0 }),
    ];
    const next = [
      makeRow({ tripId: "HSL:trip-a", departureDelay: 60 }),
      makeRow({ tripId: "HSL:trip-b", departureDelay: 0 }),
    ];
    const changed = diffDepartures(prev, next);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.tripId).toBe("HSL:trip-a");
    expect(changed[0]!.departureDelay).toBe(60);
  });

  it("detects arrivalDelay changes", () => {
    const prev = [makeRow({ arrivalDelay: 0 })];
    const next = [makeRow({ arrivalDelay: 30 })];
    expect(diffDepartures(prev, next)).toEqual(next);
  });

  it("detects realtime-flag flips (schedule → realtime upgrade)", () => {
    const prev = [makeRow({ realtime: false })];
    const next = [makeRow({ realtime: true })];
    expect(diffDepartures(prev, next)).toEqual(next);
  });

  it("ignores scheduledDeparture changes (schedule-only updates do not emit)", () => {
    const prev = [makeRow({ scheduledDeparture: 36000 })];
    const next = [makeRow({ scheduledDeparture: 36060 })];
    expect(diffDepartures(prev, next)).toEqual([]);
  });

  it("treats new tripIds in next as changed", () => {
    const prev = [makeRow({ tripId: "HSL:trip-a" })];
    const next = [
      makeRow({ tripId: "HSL:trip-a" }),
      makeRow({ tripId: "HSL:trip-b" }),
    ];
    const changed = diffDepartures(prev, next);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.tripId).toBe("HSL:trip-b");
  });

  it("distinguishes the same tripId across service days", () => {
    const prev = [makeRow({ tripId: "HSL:trip-a", serviceDay: 1_730_000_000 })];
    const next = [
      makeRow({ tripId: "HSL:trip-a", serviceDay: 1_730_000_000 }),
      makeRow({ tripId: "HSL:trip-a", serviceDay: 1_730_086_400 }),
    ];
    const changed = diffDepartures(prev, next);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.serviceDay).toBe(1_730_086_400);
  });

  it("falls back to composite key when tripId is missing", () => {
    const prev = [makeRow({ tripId: undefined, departureDelay: 0 })];
    const next = [makeRow({ tripId: undefined, departureDelay: 0 })];
    expect(diffDepartures(prev, next)).toEqual([]);
  });
});
