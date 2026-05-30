import { StopRow } from "./StopRow";
import type { StopListProps } from "./types";

/**
 * Ordered stop list with a continuous spine on the left and a per-mode
 * accent colour. Re-used by TripDetail (this chunk) and LineView
 * (Chunk 5).
 *
 * Owns column geometry only — row rendering lives in `StopRow`, time
 * rendering in `StopTime`. No business logic.
 */
export function StopList({ stops, modeToken, ariaLabel }: StopListProps) {
  return (
    <ol
      className={`stop-list stop-list--mode-${modeToken}`}
      aria-label={ariaLabel}
    >
      {stops.map(({ id, ...row }) => (
        <StopRow key={id} {...row} />
      ))}
    </ol>
  );
}
