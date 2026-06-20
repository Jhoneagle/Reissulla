import { describe, it, expect } from "vitest";
import {
  buildVehicleTopic,
  decodeHfp,
} from "../adapters/digitransit-mqtt/client.js";

const NOW = 1_730_000_000_000;

describe("buildVehicleTopic", () => {
  it("strips the feed prefix and filters to vp events for the route", () => {
    expect(buildVehicleTopic("HSL:1058")).toBe(
      "/hfp/v2/journey/ongoing/vp/+/+/+/1058/#",
    );
  });

  it("passes through a prefix-less route id unchanged", () => {
    expect(buildVehicleTopic("4611")).toBe(
      "/hfp/v2/journey/ongoing/vp/+/+/+/4611/#",
    );
  });
});

describe("decodeHfp", () => {
  it("maps a well-formed VP payload into a VehiclePosition", () => {
    const payload = JSON.stringify({
      VP: {
        oper: 22,
        veh: 423,
        route: "1058",
        dir: "1",
        lat: 60.1699,
        long: 24.9384,
        hdg: 145,
        spd: 8.3,
        dl: -30,
        tsi: 1_730_000_001,
      },
    });

    const v = decodeHfp(payload, "HSL:1058", NOW);

    expect(v).toEqual({
      vehicleId: "22/423",
      routeId: "HSL:1058",
      // HFP dir is 1-based; GTFS directionId is 0-based.
      directionId: "0",
      lat: 60.1699,
      lon: 24.9384,
      bearing: 145,
      speed: 8.3,
      // HFP dl is seconds ahead of schedule; GTFS delay is positive = late.
      delaySeconds: 30,
      ts: 1_730_000_001_000,
    });
  });

  it("falls back to `now` when no timestamp is present", () => {
    const payload = JSON.stringify({
      VP: { veh: 7, lat: 60, long: 24 },
    });
    const v = decodeHfp(payload, "HSL:1058", NOW);
    expect(v?.ts).toBe(NOW);
    expect(v?.vehicleId).toBe("7");
    expect(v?.delaySeconds).toBeNull();
    expect(v?.directionId).toBeUndefined();
  });

  it("rejects a non-VP event (e.g. a door / arrival message)", () => {
    const payload = JSON.stringify({ DUE: { veh: 1, lat: 60, long: 24 } });
    expect(decodeHfp(payload, "HSL:1058", NOW)).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(decodeHfp("{not json", "HSL:1058", NOW)).toBeNull();
  });

  it("rejects a ping missing coordinates", () => {
    const payload = JSON.stringify({ VP: { veh: 1, dir: "2" } });
    expect(decodeHfp(payload, "HSL:1058", NOW)).toBeNull();
  });

  it("decodes a Buffer payload identically to a string", () => {
    const obj = { VP: { veh: 9, lat: 61, long: 25, tsi: 1_730_000_002 } };
    const str = JSON.stringify(obj);
    expect(decodeHfp(Buffer.from(str, "utf8"), "HSL:1058", NOW)).toEqual(
      decodeHfp(str, "HSL:1058", NOW),
    );
  });
});
