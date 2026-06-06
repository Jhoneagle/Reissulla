import { describe, it, expect } from "vitest";
import { scenarios } from "@reissulla/test-fixtures";
import { openMeteoAirQuality } from "../adapters/open-meteo-air-quality/index.js";
import { fmiAdapter } from "../adapters/fmi/index.js";
import { fintrafficAdapter } from "../adapters/fintraffic/index.js";
import type { AdapterContext } from "../adapters/types.js";

const { HELSINKI_COORD, WEATHER_ERROR_COORD } = scenarios;

function ctx(locale: "fi" | "en" = "fi"): AdapterContext {
  return { signal: new AbortController().signal, locale };
}

describe("openMeteoAirQuality.getCurrent", () => {
  it("parses the canned Helsinki AQ + pollen payload", async () => {
    const { airQuality, pollen } = await openMeteoAirQuality.getCurrent(
      HELSINKI_COORD.lat,
      HELSINKI_COORD.lon,
      ctx(),
    );
    expect(airQuality.europeanAqi).toBe(32);
    expect(airQuality.pm2_5).toBe(6.1);
    expect(pollen.birch).toBe(2.1);
    expect(pollen.olive).toBe(0);
  });

  it("propagates upstream HTTP errors", async () => {
    await expect(
      openMeteoAirQuality.getCurrent(
        WEATHER_ERROR_COORD.lat,
        WEATHER_ERROR_COORD.lon,
        ctx(),
      ),
    ).rejects.toThrow();
  });
});

describe("fmiAdapter.getWarnings", () => {
  it("returns the Finnish description when locale is 'fi'", async () => {
    const warnings = await fmiAdapter.getWarnings({ region: "" }, ctx("fi"));
    expect(warnings.length).toBe(1);
    const w = warnings[0]!;
    expect(w.region).toBe("FI:Uusimaa");
    expect(w.severity).toBe("severe");
    expect(w.type).toBe("wind");
    expect(w.description).toContain("tuuli");
    expect(w.bounds?.type).toBe("Polygon");
  });

  it("returns the English description when locale is 'en'", async () => {
    const warnings = await fmiAdapter.getWarnings({ region: "" }, ctx("en"));
    expect(warnings[0]?.description).toContain("wind");
  });

  it("returns an empty array when FMI has no active warnings", async () => {
    const warnings = await fmiAdapter.getWarnings(
      { region: "FI:Empty" },
      ctx(),
    );
    expect(warnings).toEqual([]);
  });

  it("composes a deterministic tile URL", () => {
    const url = fmiAdapter.getRadarTileUrl({
      z: 6,
      x: 38,
      y: 19,
      timestamp: 1_780_000_000,
    });
    expect(url).toContain("TIME=");
    expect(url).toContain("/6/");
    expect(url).toContain("/38/");
    expect(url).toContain("/19");
  });
});

describe("fintrafficAdapter.getRoadConditions", () => {
  it("picks the section nearest the requested coordinate", async () => {
    const result = await fintrafficAdapter.getRoadConditions(
      HELSINKI_COORD.lat,
      HELSINKI_COORD.lon,
      ctx(),
    );
    expect(result).not.toBeNull();
    expect(result!.sectionName).toBe("Helsinki keskusta");
    expect(result!.surfaceState).toBe("dry");
    expect(result!.distanceKm).toBeLessThan(1);
  });

  it("picks a more distant section when the query is closer to it", async () => {
    const result = await fintrafficAdapter.getRoadConditions(
      60.29,
      25.04,
      ctx(),
    );
    expect(result?.sectionName).toBe("Vantaa Tikkurila");
    expect(result?.surfaceState).toBe("partly-icy");
  });
});
