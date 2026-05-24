import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import {
  buildWeatherLede,
  type CardinalDirection,
  type LedeContext,
  type WindBucket,
} from "./lede";
import enMessages from "../i18n/messages-en.json";
import fiMessages from "../i18n/messages-fi.json";

/**
 * Lightweight intl-formatters stand-in. The real LocationCard wires
 * react-intl's `intl.formatMessage`; for unit purposes we only need
 * to evaluate the same ICU MessageFormat strings.
 */
function makeFormatters(locale: "en" | "fi") {
  const messages = locale === "en" ? enMessages : fiMessages;
  function fmt(id: string, values: Record<string, string | number> = {}) {
    const pattern = messages[id as keyof typeof messages];
    if (!pattern) throw new Error(`Missing key ${id} in ${locale}`);
    return new IntlMessageFormat(pattern, locale).format(values) as string;
  }
  return {
    formatWeatherCode: (code: number) => fmt(`weather.code.${code}`),
    formatWind: (
      direction: CardinalDirection | "Variable",
      bucket: WindBucket,
    ) => fmt("lede.wind", { direction, bucket }),
    formatCalm: () => fmt("lede.wind.calm"),
    formatSun: (
      event: "rise" | "set",
      tense: "past" | "future",
      time: string,
    ) => {
      const key =
        event === "rise"
          ? tense === "future"
            ? "lede.sun.rises_at"
            : "lede.sun.rose_at"
          : tense === "future"
            ? "lede.sun.sets_at"
            : "lede.sun.set_at";
      return fmt(key, { time });
    },
  };
}

const BASE_WEATHER = {
  temperature: 16,
  feelsLike: 14,
  humidity: 60,
  weatherCode: 1,
  weatherDescription: "Mainly clear",
  windSpeed: 12,
  windDirection: 270, // West
  isDay: true,
  timestamp: "2026-05-24T17:00:00Z",
};

// formatHHMM reads getHours() (local). Construct test ISOs from local
// clock components so the expected "20:00" survives any test-runner
// timezone.
function localISO(h: number, m = 0): string {
  return new Date(2026, 4, 24, h, m, 0, 0).toISOString();
}
const NOW_BEFORE_SUNSET = new Date(2026, 4, 24, 19, 30, 0, 0);
const NOW_BEFORE_SUNRISE = new Date(2026, 4, 24, 4, 30, 0, 0);
const NOW_AFTER_SUNSET = new Date(2026, 4, 24, 20, 30, 0, 0);
const NOW_MIDDAY = new Date(2026, 4, 24, 12, 0, 0, 0);

function ctxFor(
  locale: "en" | "fi",
  overrides: Partial<LedeContext> = {},
): LedeContext {
  return {
    weather: { ...BASE_WEATHER, ...(overrides.weather ?? {}) },
    ...makeFormatters(locale),
    ...overrides,
  };
}

describe("buildWeatherLede", () => {
  it("returns description + wind + sun clauses in English", () => {
    const out = buildWeatherLede(
      ctxFor("en", {
        sunrise: localISO(5, 0),
        sunset: localISO(20, 0),
        now: NOW_BEFORE_SUNSET,
      }),
    );
    expect(out).toContain("Mainly clear.");
    expect(out).toContain("Westerly gale.");
    expect(out).toContain("Sun sets at 20:00.");
  });

  it("returns description + wind + sun clauses in Finnish", () => {
    const out = buildWeatherLede(
      ctxFor("fi", {
        sunrise: localISO(5, 0),
        sunset: localISO(20, 0),
        now: NOW_BEFORE_SUNSET,
      }),
    );
    expect(out).toContain("Enimmäkseen selkeää.");
    expect(out).toContain("Länsituulta (kovaa).");
    expect(out).toContain("Aurinko laskee klo 20:00.");
  });

  it("never leaks English wind/sun vocabulary into the Finnish lede", () => {
    const samples: LedeContext[] = [
      // Each major bucket × a few directions, plus sun events
      ctxFor("fi", { weather: { ...BASE_WEATHER, windSpeed: 0.5 } }),
      ctxFor("fi", {
        weather: { ...BASE_WEATHER, windSpeed: 3, windDirection: 0 },
      }),
      ctxFor("fi", {
        weather: { ...BASE_WEATHER, windSpeed: 8, windDirection: 90 },
      }),
      ctxFor("fi", {
        weather: { ...BASE_WEATHER, windSpeed: 15, windDirection: 180 },
      }),
      ctxFor("fi", {
        weather: { ...BASE_WEATHER, windSpeed: 12, windDirection: 270 },
        sunrise: localISO(5, 0),
        now: NOW_BEFORE_SUNRISE,
      }),
      ctxFor("fi", {
        weather: { ...BASE_WEATHER, windSpeed: 12, windDirection: 270 },
        sunset: localISO(20, 0),
        now: NOW_AFTER_SUNSET,
      }),
    ];

    const englishOnly = [
      /\bNortherly\b/,
      /\bNortheasterly\b/,
      /\bEasterly\b/,
      /\bSoutheasterly\b/,
      /\bSoutherly\b/,
      /\bSouthwesterly\b/,
      /\bWesterly\b/,
      /\bNorthwesterly\b/,
      /\bbreeze\b/,
      /\bgale\b/,
      /\bCalm air\b/,
      /\bSun rises\b/,
      /\bSun rose\b/,
      /\bSun sets\b/,
      /\bSun set\b/,
      /\bVariable\b/,
    ];

    for (const ctx of samples) {
      const out = buildWeatherLede(ctx);
      for (const pattern of englishOnly) {
        expect(out, `unexpected English in "${out}"`).not.toMatch(pattern);
      }
    }
  });

  it("falls back to Calm clause when wind is below 1.5 m/s", () => {
    const out = buildWeatherLede(
      ctxFor("en", { weather: { ...BASE_WEATHER, windSpeed: 0.8 } }),
    );
    expect(out).toContain("Calm air.");
    expect(out).not.toContain("breeze");
  });

  it("omits the sun clause when outside the ±90 minute window", () => {
    const out = buildWeatherLede(
      ctxFor("en", {
        sunrise: localISO(5, 0),
        now: NOW_MIDDAY,
      }),
    );
    expect(out).not.toMatch(/Sun (rises|rose|sets|set)/);
  });

  it("drops the wind clause when windSpeed is NaN", () => {
    const out = buildWeatherLede(
      ctxFor("en", { weather: { ...BASE_WEATHER, windSpeed: NaN } }),
    );
    expect(out).toBe("Mainly clear.");
  });

  it("falls through to Variable when the compass degree is NaN", () => {
    const out = buildWeatherLede(
      ctxFor("en", {
        weather: { ...BASE_WEATHER, windSpeed: 12, windDirection: NaN },
      }),
    );
    expect(out).toContain("Variable gale.");
  });
});
