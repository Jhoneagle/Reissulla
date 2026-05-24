import { FormattedMessage, useIntl } from "react-intl";
import type { TransitStop } from "@reissulla/shared";
import { useRecentStops } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { vehicleModeLabel } from "../../lib/transit-utils";

interface RecentStopsListProps {
  /**
   * Called with a synthetic TransitStop (subStops populated with the row's
   * gtfsId) so the parent can drive its DepartureTable the same way as
   * stop-search results.
   */
  onSelect: (stop: TransitStop) => void;
  limit?: number;
}

export function RecentStopsList({ onSelect, limit = 3 }: RecentStopsListProps) {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data, isLoading } = useRecentStops(Boolean(user), limit);

  if (!user) return null;
  if (isLoading) return null;
  const recents = data?.data ?? [];
  if (recents.length === 0) return null;

  return (
    <section
      className="recent-stops"
      aria-label={intl.formatMessage({ id: "transit.recentStops.title" })}
    >
      <h3 className="recent-stops__title">
        <FormattedMessage id="transit.recentStops.title" />
      </h3>
      <ul className="recent-stops__list">
        {recents.map((stop) => (
          <li key={stop.id} className="recent-stops__item">
            <button
              type="button"
              className="recent-stops__button"
              onClick={() =>
                onSelect({
                  gtfsId: stop.gtfsId,
                  name: stop.name,
                  code: null,
                  lat: 0,
                  lon: 0,
                  vehicleMode: stop.vehicleMode,
                  platformCode: null,
                  isStation: stop.isStation,
                  // Seed a single sub-stop so useDepartures takes the
                  // single-id query path. When isStation is true, that
                  // hits the station departures endpoint with the same id;
                  // when false, the stop endpoint. Either way the recall
                  // resolves rather than silently 404-ing.
                  subStops: [
                    {
                      gtfsId: stop.gtfsId,
                      code: null,
                      platformCode: null,
                      vehicleMode: stop.vehicleMode,
                    },
                  ],
                })
              }
            >
              <span className="recent-stops__name">{stop.name}</span>
              {stop.vehicleMode && (
                <span className="recent-stops__mode">
                  {vehicleModeLabel(stop.vehicleMode)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
