import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseFmiWarnings } from "../adapters/fmi/parse-warnings.js";
import type { OpenMeteoAirQualityResponse } from "../adapters/open-meteo-air-quality/types.js";
import { decodeHfp } from "../adapters/digitransit-mqtt/client.js";

/**
 * Upstream-shape snapshot gate. The fixtures under `./fixtures/` are the
 * canonical raw payload shapes the adapters must keep handling — FMI WFS
 * XML, Open-Meteo Air Quality JSON, and the Digitransit/HSL HFP vehicle
 * ping. When any upstream ships a backwards-incompatible response shape,
 * these assertions fail loudly in CI rather than letting the adapter
 * degrade to empty fallbacks at runtime. The fixtures are intentionally
 * hand-maintained: a developer can `curl` (or subscribe to) the live API,
 * drop the new payload in, and see which assertion now fails to scope the
 * migration.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(here, "fixtures");

describe("FMI WFS warnings — upstream shape snapshot", () => {
  const xml = readFileSync(path.join(FIXTURE_DIR, "fmi-warnings.xml"), "utf-8");

  it("parses every field the adapter contract relies on (fi locale)", () => {
    const warnings = parseFmiWarnings(xml, "fi");
    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    expect(w.id).toBe("warning-uusimaa-wind-001");
    expect(w.severity).toBe("severe");
    expect(w.type).toBe("wind");
    expect(w.region).toBe("FI:Uusimaa");
    expect(w.startTime).toBe(Date.parse("2026-06-06T09:00:00Z"));
    expect(w.endTime).toBe(Date.parse("2026-06-06T18:00:00Z"));
    expect(w.description).toContain("tuuli");
    expect(w.bounds?.type).toBe("Polygon");
    expect(w.bounds?.coordinates[0]).toHaveLength(5);
    // GML posList is "lat lon lat lon ..." but the parsed GeoJSON ring is
    // "[lon, lat]" pairs — verify the order swap held end-to-end.
    expect(w.bounds?.coordinates[0]?.[0]).toEqual([24.8, 60.1]);
  });

  it("returns the english description when locale is 'en'", () => {
    const warnings = parseFmiWarnings(xml, "en");
    expect(warnings[0]?.description).toContain("wind");
  });
});

describe("Open-Meteo Air Quality — upstream shape snapshot", () => {
  const raw = readFileSync(
    path.join(FIXTURE_DIR, "open-meteo-air-quality.json"),
    "utf-8",
  );
  const parsed = JSON.parse(raw) as OpenMeteoAirQualityResponse;

  it("carries every current-block field the adapter reads", () => {
    const c = parsed.current;
    expect(typeof c.time).toBe("string");
    expect(typeof c.european_aqi).toBe("number");
    expect(typeof c.pm10).toBe("number");
    expect(typeof c.pm2_5).toBe("number");
    expect(typeof c.nitrogen_dioxide).toBe("number");
    expect(typeof c.sulphur_dioxide).toBe("number");
    expect(typeof c.ozone).toBe("number");
    expect(typeof c.carbon_monoxide).toBe("number");
  });

  it("carries every hourly per-taxon pollen series the adapter reads", () => {
    const h = parsed.hourly;
    expect(Array.isArray(h.time)).toBe(true);
    expect(h.time.length).toBeGreaterThan(0);
    for (const taxon of [
      "alder_pollen",
      "birch_pollen",
      "grass_pollen",
      "mugwort_pollen",
      "olive_pollen",
      "ragweed_pollen",
    ] as const) {
      const series = h[taxon];
      expect(Array.isArray(series)).toBe(true);
      expect(series.length).toBe(h.time.length);
      for (const v of series) {
        if (v !== null) expect(typeof v).toBe("number");
      }
    }
  });
});

describe("Digitransit HFP vehicle — upstream shape snapshot", () => {
  const raw = readFileSync(
    path.join(FIXTURE_DIR, "digitransit-mqtt-vehicle.json"),
    "utf-8",
  );

  it("decodes a canonical HFP vp ping into a VehiclePosition", () => {
    // `now` is fixed so the fallback branch is never silently exercised —
    // the fixture carries `tsi`, so the decoded ts must come from it.
    const v = decodeHfp(raw, "HSL:1058", 1_730_000_000_000);
    expect(v).toEqual({
      vehicleId: "22/423",
      routeId: "HSL:1058",
      // HFP dir is 1-based; GTFS directionId is 0-based.
      directionId: "0",
      lat: 60.1699,
      lon: 24.9384,
      bearing: 145,
      speed: 8.3,
      // HFP `dl` is seconds ahead of schedule; GTFS delay is positive = late.
      delaySeconds: 30,
      ts: 1_730_000_001_000,
    });
  });

  it("the broker still wraps the ping in a `VP` envelope", () => {
    // The decode hard-depends on the `VP` key; a topic/shape change that
    // dropped or renamed it would silently null every dot at runtime.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed).toHaveProperty("VP");
    const vp = parsed.VP as Record<string, unknown>;
    for (const field of ["veh", "lat", "long", "route"]) {
      expect(vp).toHaveProperty(field);
    }
  });
});
