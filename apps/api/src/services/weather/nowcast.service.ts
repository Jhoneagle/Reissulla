/**
 * Accessible rain nowcast — derives a "raining in N minutes" state from
 * FMI radar + Open-Meteo precipitation probability. The composition
 * endpoint surfaces this alongside the snapshot so a single dashboard
 * round-trip carries both visual + spoken modalities.
 *
 * Foundations chunk lands the contract only — the function returns null
 * everywhere so the snapshot endpoint already exposes the field shape.
 * The real state machine + bilingual text templates land in the radar
 * chunk together with the FMI radar timeline consumer.
 */

export type RainNowcastState =
  | "no-rain"
  | "rain-incoming"
  | "raining"
  | "rain-ending";

export interface RainNowcast {
  state: RainNowcastState;
  /** Minutes from now (positive = future). Absent on `no-rain`. */
  minutesUntilStart?: number;
  /** Duration of the band in minutes. */
  estimatedDurationMin?: number;
  /** Plain-language text suitable for an ARIA live region. */
  textFi: string;
  textEn: string;
}

export async function getRainNowcast(
  _lat: number,
  _lon: number,
): Promise<RainNowcast | null> {
  return null;
}
