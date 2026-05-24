/**
 * Pinned stops and lines — user-owned shortcuts surfaced on the dashboard
 * and the transit page. Server-side row shape is the same as the wire shape;
 * `pinnedAt` is the ISO timestamp the row was created at.
 *
 * No per-user cap is enforced — single-user hobby deployment, so a runaway
 * pin loop would be a UI bug to fix, not a quota to defend.
 */

export interface PinnedStop {
  gtfsId: string;
  name: string;
  /** BUS / TRAM / RAIL / SUBWAY / FERRY. Null for stations spanning modes. */
  vehicleMode: string | null;
  /**
   * True when the original entry was a station (use station departures
   * query on recall). False or missing for single-stop pins.
   */
  isStation?: boolean;
  /** ISO-8601 timestamp. */
  pinnedAt: string;
}

export interface PinnedLine {
  gtfsId: string;
  /** Short name as riders see it on the destination sign (e.g. "550"). */
  name: string;
  vehicleMode: string;
  /** ISO-8601 timestamp. */
  pinnedAt: string;
}
