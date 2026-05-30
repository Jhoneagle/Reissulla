import type { ReactNode } from "react";

/**
 * Row state.
 *
 * `past`     — stop already visited.
 * `current`  — vehicle is at this stop, dwelling. Renders the hairline rule
 *              and the filled dot per the design.
 * `upcoming` — future stop on the trip.
 * `terminus` — the last stop. Visually a small filled dot; useful for both
 *              destination terminus (TripDetail) and the "this is the end
 *              of the line" marker in the future LineView.
 */
export type StopRowState = "past" | "current" | "upcoming" | "terminus";

export interface StopRowProps {
  /** GTFS stop name, e.g. "Kamppi". */
  name: string;
  /** Plex-mono secondary line under the name: "raide 3 · 5 min", etc. */
  secondary?: string;
  /** Typically a <StopTime />, but any node works — keeps the row dumb. */
  time: ReactNode;
  state: StopRowState;
}

export interface StopListProps {
  stops: Array<StopRowProps & { id: string }>;
  /** bus | tram | rail | subway | ferry — drives spine + dot colour. */
  modeToken: string;
  ariaLabel: string;
}

export interface StopTimeProps {
  /** Unix seconds — the time displayed prominently. */
  primary: number;
  /**
   * Scheduled time when the actual is delayed past `delayThreshold`. Renders
   * as a strikethrough to the left of the primary.
   */
  scheduled?: number;
  /** Seconds; positive = late, negative = early, 0 = on time. */
  delay?: number;
  /**
   * Second time after a "→" separator — used when arrival and departure
   * differ to the minute (long dwell or terminus turnaround).
   */
  secondary?: number;
  /** Render a small "{n} min" line under the time. TripDetail only. */
  relativeFromNow?: boolean;
  /** Override `Date.now()` for deterministic tests. */
  nowUnix?: number;
}
