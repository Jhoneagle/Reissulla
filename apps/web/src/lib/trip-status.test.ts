import { describe, it, expect } from "vitest";
import type { TripDetailStop } from "@reissulla/shared";
import { findCurrentStop } from "./trip-status";

function stop(
  index: number,
  arrivalTime: number,
  departureTime: number = arrivalTime,
): TripDetailStop {
  return {
    gtfsId: `HSL:${1000 + index}`,
    name: `Stop ${index}`,
    platformCode: null,
    arrivalTime,
    departureTime,
    scheduledArrival: arrivalTime,
    scheduledDeparture: departureTime,
    arrivalDelay: 0,
    departureDelay: 0,
    realtime: true,
    stopPositionInPattern: index,
    canBoard: true,
    canAlight: true,
  };
}

// Anchor at unix 1000000.
const T0 = 1_000_000;
const MIN = 60;
const HOUR = 60 * MIN;

// Trip: stop 0 at T0, stop 1 at T0+5min (dwell 30s), stop 2 at T0+10min (terminus).
const stops = [
  stop(0, T0, T0 + 30),
  stop(1, T0 + 5 * MIN, T0 + 5 * MIN + 30),
  stop(2, T0 + 10 * MIN, T0 + 10 * MIN + 30),
];

describe("findCurrentStop", () => {
  it("returns 'inactive' for an empty stop list", () => {
    expect(findCurrentStop([], T0)).toEqual({ kind: "inactive" });
  });

  it("returns 'inactive' more than an hour before the first stop", () => {
    expect(findCurrentStop(stops, T0 - HOUR - 60)).toEqual({
      kind: "inactive",
    });
  });

  it("returns 'inactive' more than an hour after the last stop", () => {
    const last = stops[stops.length - 1]!;
    expect(findCurrentStop(stops, last.arrivalTime + HOUR + 60)).toEqual({
      kind: "inactive",
    });
  });

  it("returns 'not-started' within the hour leading up to the first stop", () => {
    expect(findCurrentStop(stops, T0 - 30 * MIN)).toEqual({
      kind: "not-started",
    });
  });

  it("returns 'departed' within the hour after the last stop", () => {
    const last = stops[stops.length - 1]!;
    expect(findCurrentStop(stops, last.departureTime + 30 * MIN)).toEqual({
      kind: "departed",
    });
  });

  it("returns 'at' the dwell window around a through stop", () => {
    const mid = stops[1]!;
    // Exactly at arrival.
    expect(findCurrentStop(stops, mid.arrivalTime)).toEqual({
      kind: "at",
      index: 1,
    });
    // 20s after departure — inside the 30s tolerance.
    expect(findCurrentStop(stops, mid.departureTime + 20)).toEqual({
      kind: "at",
      index: 1,
    });
    // 25s before arrival — inside the tolerance.
    expect(findCurrentStop(stops, mid.arrivalTime - 25)).toEqual({
      kind: "at",
      index: 1,
    });
  });

  it("returns 'approaching' between two stops", () => {
    // 2 minutes before stop 1's arrival, well clear of stop 0.
    const mid = stops[1]!;
    const result = findCurrentStop(stops, mid.arrivalTime - 2 * MIN);
    expect(result).toEqual({ kind: "approaching", index: 1, minutesAway: 2 });
  });

  it("rounds 'minutesAway' to the nearest minute", () => {
    const mid = stops[1]!;
    // 90s before arrival → 2 min (rounds up).
    const result = findCurrentStop(stops, mid.arrivalTime - 90);
    expect(result).toEqual({ kind: "approaching", index: 1, minutesAway: 2 });
  });

  it("fires 'at' even on a zero-dwell stop thanks to the tolerance", () => {
    const zeroDwell = [
      stop(0, T0, T0),
      stop(1, T0 + 5 * MIN, T0 + 5 * MIN),
      stop(2, T0 + 10 * MIN, T0 + 10 * MIN),
    ];
    const mid = zeroDwell[1]!;
    // 10s after arr/dep — inside ±30s tolerance.
    expect(findCurrentStop(zeroDwell, mid.arrivalTime + 10)).toEqual({
      kind: "at",
      index: 1,
    });
  });

  it("honours a custom dwell tolerance", () => {
    const mid = stops[1]!;
    // 60s after departure — outside the default ±30s tolerance.
    expect(findCurrentStop(stops, mid.departureTime + 60)).not.toMatchObject({
      kind: "at",
    });
    // Same moment with a 90s tolerance — still 'at'.
    expect(findCurrentStop(stops, mid.departureTime + 60, 90)).toEqual({
      kind: "at",
      index: 1,
    });
  });
});
