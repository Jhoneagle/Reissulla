/**
 * Accessible rain nowcast service. Two layers:
 *
 *   `computeRainNowcast(inputs)` — pure state machine. Folds an FMI radar
 *     intensity timeline plus an Open-Meteo hourly precipitation
 *     probability lookahead into one of four states, attaches a duration
 *     estimate, picks rain-vs-snow flavor from the latest WMO code, and
 *     pre-templates the live-region copy via `nowcast-format.ts`.
 *
 *   `getRainNowcast(lat, lon)` — request-scoped wrapper. Stub during the
 *     state-machine commit; the adapter fan-out (FMI radar timeline +
 *     Open-Meteo hourly) lands in the endpoint commit alongside the new
 *     `/api/v1/weather/nowcast` route.
 *
 * The pure layer is exported on its own so the unit tests can drive the
 * full state matrix without booting the server. Composition fan-out keeps
 * calling the wrapper.
 */

import {
  formatNowcast,
  type NowcastFlavor,
  type RainNowcast,
  type RainNowcastState,
} from "@reissulla/shared";

export type { RainNowcast, RainNowcastState };

/** Open-Meteo's `precipitation` reports mm. A 5-min frame at this rate is rain. */
export const RAIN_INTENSITY_THRESHOLD_MMH = 0.2;

/** Hourly probability percentage above which the next hour is considered rainy. */
export const RAIN_INCOMING_PROBABILITY_PCT = 60;

/** Spacing between FMI radar frames in minutes — drives the duration arithmetic. */
export const RADAR_FRAME_MINUTES = 5;

/** WMO codes that mean snow rather than rain. */
const SNOW_WMO_CODES = new Set([71, 73, 75, 77, 85, 86]);

export interface NowcastInputs {
  /**
   * Radar intensities (mm/h equivalent) ordered oldest → newest. At least
   * three frames recommended; the state machine reads the trailing three
   * to decide between "raining" / "rain-ending" / "no-rain".
   */
  intensitiesMmh: number[];
  /**
   * Open-Meteo hourly precipitation probability percentages, starting at
   * the current hour and going forward. The first three entries drive the
   * `rain-incoming` lookahead window.
   */
  hourlyPrecipProb: number[];
  /** WMO weather code for the current hour — picks rain vs snow flavor. */
  currentWeatherCode: number;
}

function flavorFromCode(code: number): NowcastFlavor {
  return SNOW_WMO_CODES.has(code) ? "snow" : "rain";
}

function trailingRunMinutes(intensities: number[]): number {
  let count = 0;
  for (let i = intensities.length - 1; i >= 0; i--) {
    if ((intensities[i] ?? 0) >= RAIN_INTENSITY_THRESHOLD_MMH) count++;
    else break;
  }
  return count * RADAR_FRAME_MINUTES;
}

function firstIncomingHourIndex(probs: number[]): number {
  const lookahead = Math.min(probs.length, 3);
  for (let i = 0; i < lookahead; i++) {
    if ((probs[i] ?? 0) >= RAIN_INCOMING_PROBABILITY_PCT) return i;
  }
  return -1;
}

function minutesUntilStartFromHour(idx: number): number {
  // Hourly buckets don't tell us where inside the hour rain starts; pick
  // the midpoint of the matching hour and project forward. 30 / 90 / 150.
  return idx * 60 + 30;
}

/**
 * Pure state machine — no fetches, no clocks beyond what the inputs supply.
 * Returns `null` for inputs that don't have enough signal (empty intensity
 * timeline or empty hourly window); callers treat null as "no nowcast".
 */
export function computeRainNowcast(inputs: NowcastInputs): RainNowcast | null {
  const { intensitiesMmh, hourlyPrecipProb, currentWeatherCode } = inputs;
  if (intensitiesMmh.length === 0 || hourlyPrecipProb.length === 0) return null;

  const flavor = flavorFromCode(currentWeatherCode);
  const latest = intensitiesMmh[intensitiesMmh.length - 1] ?? 0;
  const latestIsRain = latest >= RAIN_INTENSITY_THRESHOLD_MMH;
  const recentWindow = intensitiesMmh.slice(-3);
  const hadRecentRain = recentWindow.some(
    (v) => v >= RAIN_INTENSITY_THRESHOLD_MMH,
  );
  const hourlyNow = hourlyPrecipProb[0] ?? 0;

  if (latestIsRain) {
    // Band trailing off when both the latest hourly bucket is low AND the
    // next-hour bucket (when present) is also low; otherwise treat as
    // ongoing rain so the live region doesn't flap mid-band.
    const nextHour = hourlyPrecipProb[1] ?? hourlyNow;
    if (hourlyNow < 30 && nextHour < 30) {
      const base: RainNowcast = {
        state: "rain-ending",
        flavor,
        estimatedDurationMin: RADAR_FRAME_MINUTES * 2,
        textFi: "",
        textEn: "",
      };
      const { textFi, textEn } = formatNowcast({
        state: base.state,
        flavor,
        estimatedDurationMin: base.estimatedDurationMin,
      });
      return { ...base, textFi, textEn };
    }
    const dur = trailingRunMinutes(intensitiesMmh);
    const base: RainNowcast = {
      state: "raining",
      flavor,
      estimatedDurationMin: dur > 0 ? dur : undefined,
      textFi: "",
      textEn: "",
    };
    const { textFi, textEn } = formatNowcast({
      state: base.state,
      flavor,
      estimatedDurationMin: base.estimatedDurationMin,
    });
    return { ...base, textFi, textEn };
  }

  // Latest frame is clean.
  if (hadRecentRain) {
    // Just stopped within the last ~10 min — surface as rain-ending so the
    // dashboard says "stopping" rather than "starting".
    const base: RainNowcast = {
      state: "rain-ending",
      flavor,
      estimatedDurationMin: RADAR_FRAME_MINUTES,
      textFi: "",
      textEn: "",
    };
    const { textFi, textEn } = formatNowcast({
      state: base.state,
      flavor,
      estimatedDurationMin: base.estimatedDurationMin,
    });
    return { ...base, textFi, textEn };
  }

  const incomingIdx = firstIncomingHourIndex(hourlyPrecipProb);
  if (incomingIdx >= 0) {
    const minutesUntilStart = minutesUntilStartFromHour(incomingIdx);
    const base: RainNowcast = {
      state: "rain-incoming",
      flavor,
      minutesUntilStart,
      textFi: "",
      textEn: "",
    };
    const { textFi, textEn } = formatNowcast({
      state: base.state,
      flavor,
      minutesUntilStart,
    });
    return { ...base, textFi, textEn };
  }

  const base: RainNowcast = {
    state: "no-rain",
    flavor,
    textFi: "",
    textEn: "",
  };
  const { textFi, textEn } = formatNowcast({ state: base.state, flavor });
  return { ...base, textFi, textEn };
}

import { openMeteoForecast } from "../../adapters/open-meteo-forecast/index.js";
import type { AdapterContext } from "../../adapters/types.js";

/**
 * Request-scoped wrapper. Fetches the next-day Open-Meteo hourly slice and
 * folds it through the pure state machine. The 14-day snapshot cache and
 * this 1-day call live in separate slots on purpose — the radar / nowcast
 * surface polls once a minute and a 14-day payload would be 80× the bytes
 * needed. Output is cached for 60 s by the endpoint and composition
 * call-sites independently; this function deliberately stays cache-free
 * so callers can compose their own TTL.
 */
export async function getRainNowcast(
  lat: number,
  lon: number,
  ctx: AdapterContext,
): Promise<RainNowcast | null> {
  const forecast = await openMeteoForecast.getForecast(lat, lon, ctx, {
    forecastDays: 1,
  });
  const hourly = forecast.hourly;
  if (hourly.length === 0) return null;

  // Pick the first future hour as "now" — Open-Meteo's local-zoned times
  // mean the first entry can already be in the past on a fresh request.
  const nowHourPrefix = new Date().toISOString().slice(0, 13);
  let nowIdx = 0;
  for (let i = 0; i < hourly.length; i++) {
    if ((hourly[i]?.time ?? "").slice(0, 13) >= nowHourPrefix) {
      nowIdx = i;
      break;
    }
  }

  const currentHour = hourly[nowIdx];
  if (!currentHour) return null;
  const lookahead = hourly.slice(nowIdx, nowIdx + 3);

  return computeRainNowcast({
    intensitiesMmh: [currentHour.precipitation ?? 0],
    hourlyPrecipProb: lookahead.map((h) => h.precipitationProbability ?? 0),
    currentWeatherCode: currentHour.weatherCode,
  });
}
