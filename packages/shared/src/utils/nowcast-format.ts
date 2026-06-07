/**
 * Bilingual text templates for the rain / snow nowcast. Pure module —
 * the service layer in `apps/api` derives state + numbers, then this
 * helper renders the live-region copy in fi + en. Same templates are
 * reused by the future iCal description field (Phase 5), so we keep
 * the surface explicit and side-effect-free.
 *
 * Snow phrasing is selected by `flavor` — derived upstream from the
 * latest hourly `weather_code`. Rain is the default; everything else
 * stays in relative minutes so the copy survives a service-day
 * rollover without re-rendering against a clock.
 */

import type {
  NowcastFlavor,
  RainNowcastState,
} from "../types/weather-snapshot.js";

export interface NowcastFormatInput {
  state: RainNowcastState;
  flavor: NowcastFlavor;
  /** Required when `state === "rain-incoming"`. */
  minutesUntilStart?: number;
  /**
   * Required when `state === "raining"` or `state === "rain-ending"`.
   * For `raining`, this is the band's elapsed duration so far; for
   * `rain-ending`, it's the expected forward minutes before it stops.
   */
  estimatedDurationMin?: number;
}

export interface NowcastFormatOutput {
  textFi: string;
  textEn: string;
}

function rounded(n: number): number {
  // Templates show whole minutes — the underlying numbers come from
  // 5-minute radar frames and hourly probability buckets, so anything
  // finer would be false precision.
  return Math.max(0, Math.round(n));
}

export function formatNowcast(input: NowcastFormatInput): NowcastFormatOutput {
  const { state, flavor } = input;

  if (state === "no-rain") {
    return {
      textFi: "Ei sateita näkyvissä.",
      textEn: "No precipitation expected.",
    };
  }

  if (state === "rain-incoming") {
    const min = rounded(input.minutesUntilStart ?? 0);
    if (flavor === "snow") {
      return {
        textFi: `Lumisade alkaa noin ${min} minuutin kuluttua.`,
        textEn: `Snow expected in about ${min} minutes.`,
      };
    }
    return {
      textFi: `Sade alkaa noin ${min} minuutin kuluttua.`,
      textEn: `Rain expected in about ${min} minutes.`,
    };
  }

  if (state === "raining") {
    const dur = input.estimatedDurationMin;
    if (flavor === "snow") {
      if (dur === undefined) {
        return { textFi: "Lumisade käynnissä.", textEn: "Snow falling now." };
      }
      const m = rounded(dur);
      return {
        textFi: `Lumisade käynnissä. Kestänyt noin ${m} minuuttia.`,
        textEn: `Snow falling now. Ongoing for about ${m} minutes.`,
      };
    }
    if (dur === undefined) {
      return { textFi: "Sataa nyt.", textEn: "Raining now." };
    }
    const m = rounded(dur);
    return {
      textFi: `Sataa nyt. Kestänyt noin ${m} minuuttia.`,
      textEn: `Raining now. Ongoing for about ${m} minutes.`,
    };
  }

  // rain-ending
  const dur = rounded(input.estimatedDurationMin ?? 0);
  if (flavor === "snow") {
    return {
      textFi: `Lumisade päättyy noin ${dur} minuutin kuluttua.`,
      textEn: `Snow ending in about ${dur} minutes.`,
    };
  }
  return {
    textFi: `Sade päättyy noin ${dur} minuutin kuluttua.`,
    textEn: `Rain ending in about ${dur} minutes.`,
  };
}
