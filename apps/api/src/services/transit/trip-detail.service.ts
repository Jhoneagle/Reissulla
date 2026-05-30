import {
  DEFAULT_PERSONA,
  nearestActiveDate,
  unixFromServiceDate,
  type Persona,
  type TransitMode,
  type TripDetail,
  type TripDetailStop,
} from "@reissulla/shared";
import { NotFoundError } from "../../utils/error-envelope.js";
import { fetchAndCacheTrip } from "./trip-cache.js";

/**
 * Trip drill-down service. Anchors the trip to the activeDate closest to
 * the service-day of `now`, then resolves every stoptime offset to an
 * absolute unix epoch via the GTFS noon-12h formula. The FE consumes the
 * same epoch contract as `TransitDeparture` so a click-through from the
 * departure board reads times consistently.
 *
 * `nowUnix` is injectable for deterministic tests. Production callers
 * omit it and get the current wall clock.
 */
export async function getTripDetail(
  tripId: string,
  persona: Persona = DEFAULT_PERSONA,
  nowUnix: number = Math.floor(Date.now() / 1000),
): Promise<{ data: TripDetail; cached: boolean }> {
  const { data: raw, cached } = await fetchAndCacheTrip(tripId, persona);

  if (raw === null) {
    throw new NotFoundError(`Trip not found: ${tripId}`, "TRIP_NOT_FOUND");
  }
  if (raw.activeDates.length === 0) {
    throw new NotFoundError(
      `Trip has no active dates: ${tripId}`,
      "TRIP_INACTIVE",
    );
  }

  const anchor = nearestActiveDate(raw.activeDates, nowUnix);
  if (anchor === null) {
    throw new NotFoundError(
      `Trip has no anchor service date: ${tripId}`,
      "TRIP_INACTIVE",
    );
  }

  const stops: TripDetailStop[] = raw.stoptimes
    .map(
      (st): TripDetailStop => ({
        gtfsId: st.stop.gtfsId,
        name: st.stop.name,
        platformCode: st.stop.platformCode,
        arrivalTime: unixFromServiceDate(anchor, st.realtimeArrival),
        departureTime: unixFromServiceDate(anchor, st.realtimeDeparture),
        scheduledArrival: unixFromServiceDate(anchor, st.scheduledArrival),
        scheduledDeparture: unixFromServiceDate(anchor, st.scheduledDeparture),
        arrivalDelay: st.arrivalDelay,
        departureDelay: st.departureDelay,
        realtime: st.realtime,
        stopPositionInPattern: st.stopPositionInPattern,
        canBoard: st.pickupType !== "NONE",
        canAlight: st.dropoffType !== "NONE",
      }),
    )
    // Defensive sort — upstream is meant to deliver stoptimes in pattern
    // order but the schema doesn't guarantee it.
    .sort((a, b) => a.stopPositionInPattern - b.stopPositionInPattern);

  const directionId: 0 | 1 | null =
    raw.directionId === "0" ? 0 : raw.directionId === "1" ? 1 : null;

  const data: TripDetail = {
    tripId: raw.gtfsId,
    route: {
      gtfsId: raw.route.gtfsId,
      shortName: raw.route.shortName,
      longName: raw.route.longName,
      mode: raw.route.mode as TransitMode,
      color: raw.route.color,
    },
    pattern: {
      directionId,
      headsign: raw.tripHeadsign,
    },
    agency: {
      gtfsId: raw.route.agency?.gtfsId ?? "",
      name: raw.route.agency?.name ?? "",
    },
    serviceDate: anchor,
    serviceDates: [...raw.activeDates].sort(),
    stops,
  };

  return { data, cached };
}
