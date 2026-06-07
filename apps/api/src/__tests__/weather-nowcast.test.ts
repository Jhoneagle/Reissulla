import { describe, it, expect } from "vitest";
import { formatNowcast } from "@reissulla/shared";
import {
  RAIN_INCOMING_PROBABILITY_PCT,
  RAIN_INTENSITY_THRESHOLD_MMH,
  computeRainNowcast,
  type NowcastInputs,
} from "../services/weather/nowcast.service.js";

/**
 * The pure state machine + bilingual formatter for the rain / snow
 * nowcast. Endpoint + adapter fan-out are tested in
 * `weather-nowcast-endpoint.test.ts` (introduced alongside the route).
 *
 * Intensity values are mm/h; probabilities are percent. The clear-sky WMO
 * code (1) is the default for rain-flavored tests; snowfall codes
 * (71–86) flip the formatter into snow phrasing.
 */

const RAIN_CODE = 1; // "Mainly clear" — anything non-snow flips flavor to rain
const SNOW_CODE = 73; // "Moderate snowfall"

function rainingIntensities(frames = 4): number[] {
  return Array.from({ length: frames }, () => RAIN_INTENSITY_THRESHOLD_MMH + 1);
}

function clearIntensities(frames = 4): number[] {
  return Array.from({ length: frames }, () => 0);
}

function inputs(overrides: Partial<NowcastInputs> = {}): NowcastInputs {
  return {
    intensitiesMmh: clearIntensities(),
    hourlyPrecipProb: [10, 10, 10],
    currentWeatherCode: RAIN_CODE,
    ...overrides,
  };
}

describe("formatNowcast", () => {
  it("renders no-rain in fi + en without numeric placeholders", () => {
    const out = formatNowcast({ state: "no-rain", flavor: "rain" });
    expect(out.textFi).toBe("Ei sateita näkyvissä.");
    expect(out.textEn).toBe("No precipitation expected.");
  });

  it("formats rain-incoming with rounded minutes (rain)", () => {
    const out = formatNowcast({
      state: "rain-incoming",
      flavor: "rain",
      minutesUntilStart: 29.6,
    });
    expect(out.textFi).toContain("30");
    expect(out.textFi).toMatch(/Sade alkaa/);
    expect(out.textEn).toMatch(/Rain expected/);
  });

  it("flips to snow phrasing when flavor is snow", () => {
    const out = formatNowcast({
      state: "rain-incoming",
      flavor: "snow",
      minutesUntilStart: 30,
    });
    expect(out.textFi).toMatch(/Lumisade alkaa/);
    expect(out.textEn).toMatch(/Snow expected/);
  });

  it("omits duration phrasing on raining when none provided", () => {
    const rain = formatNowcast({ state: "raining", flavor: "rain" });
    expect(rain.textEn).toBe("Raining now.");
    const snow = formatNowcast({ state: "raining", flavor: "snow" });
    expect(snow.textEn).toBe("Snow falling now.");
  });

  it("appends ongoing duration when raining with a positive estimate", () => {
    const out = formatNowcast({
      state: "raining",
      flavor: "rain",
      estimatedDurationMin: 15,
    });
    expect(out.textEn).toMatch(/Raining now\. Ongoing for about 15 minutes/);
    expect(out.textFi).toMatch(/Kestänyt noin 15 minuuttia/);
  });

  it("renders rain-ending with forward minutes", () => {
    const out = formatNowcast({
      state: "rain-ending",
      flavor: "rain",
      estimatedDurationMin: 10,
    });
    expect(out.textEn).toMatch(/Rain ending in about 10 minutes/);
    expect(out.textFi).toMatch(/Sade päättyy/);
  });
});

describe("computeRainNowcast", () => {
  it("returns null for empty radar timeline", () => {
    expect(
      computeRainNowcast({
        intensitiesMmh: [],
        hourlyPrecipProb: [50],
        currentWeatherCode: RAIN_CODE,
      }),
    ).toBeNull();
  });

  it("returns null for empty hourly probability window", () => {
    expect(
      computeRainNowcast({
        intensitiesMmh: clearIntensities(),
        hourlyPrecipProb: [],
        currentWeatherCode: RAIN_CODE,
      }),
    ).toBeNull();
  });

  it("emits no-rain when intensities are clear and hourly is dry", () => {
    const out = computeRainNowcast(inputs());
    expect(out).not.toBeNull();
    expect(out!.state).toBe("no-rain");
    expect(out!.flavor).toBe("rain");
    expect(out!.textEn).toBe("No precipitation expected.");
  });

  it("emits rain-incoming with a 30 / 90 / 150 minutesUntilStart ladder", () => {
    const a = computeRainNowcast(
      inputs({
        hourlyPrecipProb: [RAIN_INCOMING_PROBABILITY_PCT + 10, 10, 10],
      }),
    );
    const b = computeRainNowcast(
      inputs({
        hourlyPrecipProb: [10, RAIN_INCOMING_PROBABILITY_PCT + 10, 10],
      }),
    );
    const c = computeRainNowcast(
      inputs({
        hourlyPrecipProb: [10, 10, RAIN_INCOMING_PROBABILITY_PCT + 10],
      }),
    );
    expect(a!.state).toBe("rain-incoming");
    expect(a!.minutesUntilStart).toBe(30);
    expect(b!.minutesUntilStart).toBe(90);
    expect(c!.minutesUntilStart).toBe(150);
  });

  it("emits raining + a positive ongoing-duration when the band continues", () => {
    const out = computeRainNowcast(
      inputs({
        intensitiesMmh: rainingIntensities(4),
        hourlyPrecipProb: [80, 70, 60],
      }),
    );
    expect(out!.state).toBe("raining");
    // 4 trailing rainy frames × 5 min/frame = 20 min.
    expect(out!.estimatedDurationMin).toBe(20);
    expect(out!.textEn).toMatch(/Raining now\. Ongoing for about 20 minutes/);
  });

  it("emits rain-ending when latest is rainy but the hourly outlook drops", () => {
    const out = computeRainNowcast(
      inputs({
        intensitiesMmh: [...clearIntensities(2), ...rainingIntensities(2)],
        hourlyPrecipProb: [10, 10, 10],
      }),
    );
    expect(out!.state).toBe("rain-ending");
    expect(out!.textEn).toMatch(/Rain ending in about/);
  });

  it("emits rain-ending when the band just stopped within the radar window", () => {
    const out = computeRainNowcast(
      inputs({
        intensitiesMmh: [...rainingIntensities(2), 0],
        hourlyPrecipProb: [20, 10, 10],
      }),
    );
    expect(out!.state).toBe("rain-ending");
  });

  it("picks snow flavor from a snowfall WMO code", () => {
    const out = computeRainNowcast(
      inputs({
        intensitiesMmh: rainingIntensities(3),
        hourlyPrecipProb: [80, 70, 60],
        currentWeatherCode: SNOW_CODE,
      }),
    );
    expect(out!.flavor).toBe("snow");
    expect(out!.textEn).toMatch(/Snow falling now/);
  });
});
