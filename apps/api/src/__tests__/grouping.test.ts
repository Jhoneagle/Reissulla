import { describe, it, expect } from "vitest";
import {
  groupStopsByNameAndMode,
  normalizeStopName,
} from "../services/transit/grouping.js";

describe("normalizeStopName", () => {
  it("strips short parenthetical suffixes", () => {
    expect(normalizeStopName("Itäkeskus (M)")).toBe("itäkeskus");
    expect(normalizeStopName("Pasila (J)")).toBe("pasila");
  });

  it("lowercases and trims", () => {
    expect(normalizeStopName("  Rautatientori  ")).toBe("rautatientori");
  });

  it("leaves long parentheticals alone", () => {
    expect(normalizeStopName("Helsinki (Central Station)")).toBe(
      "helsinki (central station)",
    );
  });
});

describe("groupStopsByNameAndMode", () => {
  it("splits a station into separate entries per child-stop mode", () => {
    const grouped = groupStopsByNameAndMode(
      [],
      [
        {
          gtfsId: "HSL:1000003",
          name: "Rautatientori",
          lat: 60.171,
          lon: 24.9435,
          vehicleMode: "SUBWAY",
          wheelchairBoarding: null,
          stops: [
            {
              gtfsId: "HSL:1000003_1",
              name: "Rautatientori",
              code: "M112",
              platformCode: "1",
              vehicleMode: "SUBWAY",
              wheelchairBoarding: null,
            },
            {
              gtfsId: "HSL:1000003_2",
              name: "Rautatientori",
              code: "T100",
              platformCode: "T",
              vehicleMode: "TRAM",
              wheelchairBoarding: null,
            },
          ],
        },
      ],
    );

    expect(grouped).toHaveLength(2);
    const subway = grouped.find((g) => g.vehicleMode === "SUBWAY");
    const tram = grouped.find((g) => g.vehicleMode === "TRAM");
    expect(subway?.isStation).toBe(true);
    expect(subway?.subStops).toHaveLength(1);
    expect(tram?.isStation).toBe(true);
    expect(tram?.subStops).toHaveLength(1);
  });

  it("groups identical-name stops and station children by (name, mode)", () => {
    const grouped = groupStopsByNameAndMode(
      [
        {
          gtfsId: "HSL:1040602",
          name: "Rautatientori",
          code: "0612",
          lat: 60.1709,
          lon: 24.9432,
          vehicleMode: "BUS",
          platformCode: null,
          wheelchairBoarding: null,
        },
      ],
      [
        {
          gtfsId: "HSL:1000003",
          name: "Rautatientori",
          lat: 60.171,
          lon: 24.9435,
          vehicleMode: "SUBWAY",
          wheelchairBoarding: null,
          stops: [
            {
              gtfsId: "HSL:1000003_1",
              name: "Rautatientori",
              code: "M112",
              platformCode: "1",
              vehicleMode: "SUBWAY",
              wheelchairBoarding: null,
            },
          ],
        },
      ],
    );

    expect(grouped).toHaveLength(2);
    const bus = grouped.find((g) => g.vehicleMode === "BUS");
    const subway = grouped.find((g) => g.vehicleMode === "SUBWAY");
    expect(bus?.isStation).toBe(false);
    expect(subway?.isStation).toBe(true);
  });

  it("handles a station with no child stops by falling back to the station-level mode", () => {
    const grouped = groupStopsByNameAndMode(
      [],
      [
        {
          gtfsId: "HSL:9999999",
          name: "Empty Station",
          lat: 60.0,
          lon: 24.0,
          vehicleMode: "RAIL",
          wheelchairBoarding: null,
          stops: [],
        },
      ],
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.isStation).toBe(true);
    expect(grouped[0]!.vehicleMode).toBe("RAIL");
    expect(grouped[0]!.subStops).toEqual([]);
  });

  it("uses UNKNOWN mode for child stops with no declared vehicleMode", () => {
    const grouped = groupStopsByNameAndMode(
      [],
      [
        {
          gtfsId: "HSL:8888888",
          name: "Mystery",
          lat: 60.0,
          lon: 24.0,
          vehicleMode: null,
          wheelchairBoarding: null,
          stops: [
            {
              gtfsId: "HSL:8888888_1",
              name: "Mystery",
              code: null,
              platformCode: null,
              vehicleMode: null,
              wheelchairBoarding: null,
            },
          ],
        },
      ],
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.vehicleMode).toBe("UNKNOWN");
  });

  it("deduplicates child stops appearing under the same (name, mode) key", () => {
    const grouped = groupStopsByNameAndMode(
      [],
      [
        {
          gtfsId: "HSL:s1",
          name: "Pasila",
          lat: 60.2,
          lon: 24.93,
          vehicleMode: "RAIL",
          wheelchairBoarding: null,
          stops: [
            {
              gtfsId: "HSL:p1",
              name: "Pasila",
              code: "1",
              platformCode: "1",
              vehicleMode: "RAIL",
              wheelchairBoarding: null,
            },
            {
              gtfsId: "HSL:p1",
              name: "Pasila",
              code: "1",
              platformCode: "1",
              vehicleMode: "RAIL",
              wheelchairBoarding: null,
            },
          ],
        },
      ],
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.subStops).toHaveLength(1);
  });
});
