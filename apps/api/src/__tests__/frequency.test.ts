import { describe, it, expect } from "vitest";
import type { TransitDeparture } from "@reissulla/shared";
import {
  classifyFrequency,
  deriveServiceNoteFromActiveDates,
} from "../services/transit/frequency.service.js";

function dep(
  secondsFromAnchor: number,
  base: Partial<TransitDeparture> = {},
): TransitDeparture {
  // Anchor at 2026-05-04 14:00 Europe/Helsinki = 11:00 UTC = unix 1778236800.
  // Service day is midnight local of that date.
  const anchor = 1778236800;
  return {
    routeShortName: "23",
    routeLongName: "Rautatientori — Itäkeskus",
    headsign: "Itäkeskus",
    scheduledArrival: 0,
    realtimeArrival: 0,
    arrivalDelay: 0,
    scheduledDeparture: 0,
    realtimeDeparture: secondsFromAnchor,
    departureDelay: 0,
    realtime: true,
    serviceDay: anchor,
    vehicleMode: "BUS",
    canBoard: true,
    canAlight: true,
    ...base,
  };
}

const ANCHOR_UNIX = 1778236800;

describe("classifyFrequency", () => {
  it("returns undefined for an empty list", () => {
    expect(classifyFrequency([], ANCHOR_UNIX)).toBeUndefined();
  });

  it("returns undefined when every departure is in the past", () => {
    expect(
      classifyFrequency([dep(-3600), dep(-1800), dep(-60)], ANCHOR_UNIX),
    ).toBeUndefined();
  });

  it("classifies a dense urban hub (12 departures in the next hour)", () => {
    const stream: TransitDeparture[] = [];
    for (let i = 0; i < 12; i++) stream.push(dep(i * 300)); // every 5 min
    const result = classifyFrequency(stream, ANCHOR_UNIX);
    expect(result?.regime).toBe("dense");
    expect(result?.nextHourCount).toBe(12);
    expect(result?.avgIntervalMin).toBe(5);
    expect(result?.nextDepartureUnix).toBeUndefined();
  });

  it("classifies a moderate suburban stop (4 departures in the next hour)", () => {
    const stream: TransitDeparture[] = [];
    for (let i = 0; i < 4; i++) stream.push(dep(i * 15 * 60));
    const result = classifyFrequency(stream, ANCHOR_UNIX);
    expect(result?.regime).toBe("moderate");
    expect(result?.nextHourCount).toBe(4);
    expect(result?.avgIntervalMin).toBe(15);
  });

  it("classifies sparse when the next departure is >90 min away", () => {
    const result = classifyFrequency(
      [dep(95 * 60), dep(95 * 60 + 3600)],
      ANCHOR_UNIX,
    );
    expect(result?.regime).toBe("sparse");
    expect(result?.nextDepartureUnix).toBe(ANCHOR_UNIX + 95 * 60);
  });

  it("classifies sparse when there are <3 departures in the next hour", () => {
    const result = classifyFrequency([dep(10 * 60), dep(45 * 60)], ANCHOR_UNIX);
    expect(result?.regime).toBe("sparse");
    expect(result?.nextHourCount).toBe(2);
    expect(result?.nextDepartureUnix).toBe(ANCHOR_UNIX + 10 * 60);
  });

  it("drops past departures relative to the anchor before classifying", () => {
    const stream = [
      dep(-300), // past — should be dropped
      ...Array.from({ length: 11 }, (_, i) => dep(i * 300)),
    ];
    const result = classifyFrequency(stream, ANCHOR_UNIX);
    expect(result?.nextHourCount).toBe(11);
    expect(result?.regime).toBe("dense");
  });
});

describe("deriveServiceNoteFromActiveDates", () => {
  it("returns undefined for an empty list", () => {
    expect(deriveServiceNoteFromActiveDates([])).toBeUndefined();
  });

  it("returns 'Arkisin' when every active date is a weekday", () => {
    // 2026-05-04 Mon, 05 Tue, 06 Wed, 07 Thu, 08 Fri, 11 Mon, 12 Tue
    const dates = ["20260504", "20260505", "20260506", "20260507", "20260508"];
    expect(deriveServiceNoteFromActiveDates(dates)).toBe("Arkisin");
  });

  it("returns 'Viikonloppuisin' when every active date is a weekend", () => {
    // 2026-05-02 Sat, 03 Sun, 09 Sat, 10 Sun
    const dates = ["20260502", "20260503", "20260509", "20260510"];
    expect(deriveServiceNoteFromActiveDates(dates)).toBe("Viikonloppuisin");
  });

  it("returns 'Päivittäin' when the first week covers six or more days", () => {
    // Mon Tue Wed Thu Fri Sat Sun — all seven
    const dates = [
      "20260504",
      "20260505",
      "20260506",
      "20260507",
      "20260508",
      "20260509",
      "20260510",
    ];
    expect(deriveServiceNoteFromActiveDates(dates)).toBe("Päivittäin");
  });

  it("returns 'Erikoisliikenne' for a sparse mixed pattern", () => {
    // Two weekdays and one Saturday
    const dates = ["20260504", "20260507", "20260509"];
    expect(deriveServiceNoteFromActiveDates(dates)).toBe("Erikoisliikenne");
  });
});
