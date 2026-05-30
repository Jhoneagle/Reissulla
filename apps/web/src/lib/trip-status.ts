import type { TripDetailStop } from "@reissulla/shared";
import type { IntlShape } from "react-intl";
import { formatUnixTime } from "./transit-utils";

const ONE_HOUR_SEC = 60 * 60;
const DEFAULT_DWELL_TOLERANCE_SEC = 30;

export type CurrentStop =
  | { kind: "at"; index: number }
  | { kind: "approaching"; index: number; minutesAway: number }
  | { kind: "departed" }
  | { kind: "not-started" }
  | { kind: "inactive" };

/**
 * Pick where the vehicle is on the trip "right now".
 *
 * `at`           — `nowUnix` is inside [arrival - tolerance, departure +
 *                  tolerance] of some stop. The tolerance is what makes
 *                  zero-dwell stops (arrival === departure) still register
 *                  as "at", instead of skipping straight to `approaching`.
 * `approaching`  — `nowUnix` sits between two stops on the spine.
 * `not-started`  — before the first stop but within the prior hour.
 * `departed`     — past the last stop but within the trailing hour.
 * `inactive`     — outside the run window altogether (stale tripId link,
 *                  or the user landed hours after the run ended).
 *
 * The ±1h window keeps the status sentence meaningful for the typical
 * "I just clicked from a departure board" case without claiming a
 * yesterday-morning bus is "approaching" right now.
 */
export function findCurrentStop(
  stops: TripDetailStop[],
  nowUnix: number,
  dwellToleranceSec: number = DEFAULT_DWELL_TOLERANCE_SEC,
): CurrentStop {
  if (stops.length === 0) return { kind: "inactive" };
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;

  // Well outside the run window.
  if (nowUnix < first.departureTime - ONE_HOUR_SEC) return { kind: "inactive" };
  if (nowUnix > last.arrivalTime + ONE_HOUR_SEC) return { kind: "inactive" };

  // Before the first stop, within the lead-in hour.
  if (nowUnix < first.arrivalTime - dwellToleranceSec) {
    return { kind: "not-started" };
  }
  // Past the last stop, within the trailing hour.
  if (nowUnix > last.departureTime + dwellToleranceSec) {
    return { kind: "departed" };
  }

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]!;
    const inDwell =
      nowUnix >= s.arrivalTime - dwellToleranceSec &&
      nowUnix <= s.departureTime + dwellToleranceSec;
    if (inDwell) return { kind: "at", index: i };

    const next = stops[i + 1];
    if (
      next &&
      nowUnix > s.departureTime + dwellToleranceSec &&
      nowUnix < next.arrivalTime - dwellToleranceSec
    ) {
      const minutesAway = Math.max(
        0,
        Math.round((next.arrivalTime - nowUnix) / 60),
      );
      return { kind: "approaching", index: i + 1, minutesAway };
    }
  }

  // Bounded loop above should resolve every case inside the run window;
  // returning inactive as a final type-safe fallback.
  return { kind: "inactive" };
}

/**
 * Localised status sentence for the trip-detail masthead.
 *
 * `modeWord` is the vehicle word in the active locale ("Bussi", "Ratikka",
 * "The bus", …). The caller resolves it from intl so this helper stays
 * deterministic.
 */
export function buildTripStatusPhrase(
  current: CurrentStop,
  stops: TripDetailStop[],
  modeWord: string,
  intl: IntlShape,
): string {
  switch (current.kind) {
    case "at": {
      const s = stops[current.index]!;
      return intl.formatMessage(
        { id: "transit.trip.status.atStop" },
        {
          vehicle: modeWord,
          stop: s.name,
          time: formatUnixTime(s.departureTime),
        },
      );
    }
    case "approaching": {
      const next = stops[current.index]!;
      return intl.formatMessage(
        { id: "transit.trip.status.approaching" },
        {
          vehicle: modeWord,
          stop: next.name,
          minutes: current.minutesAway,
        },
      );
    }
    case "not-started": {
      const first = stops[0]!;
      return intl.formatMessage(
        { id: "transit.trip.status.notStarted" },
        {
          vehicle: modeWord,
          stop: first.name,
          time: formatUnixTime(first.departureTime),
        },
      );
    }
    case "departed": {
      const last = stops[stops.length - 1]!;
      return intl.formatMessage(
        { id: "transit.trip.status.departed" },
        { time: formatUnixTime(last.arrivalTime) },
      );
    }
    case "inactive":
    default:
      return intl.formatMessage({ id: "transit.trip.status.inactive" });
  }
}
