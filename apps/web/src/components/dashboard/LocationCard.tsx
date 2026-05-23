import { Link } from "react-router";
import { FormattedMessage } from "react-intl";
import type { SavedLocation } from "@reissulla/shared";
import { useCurrentWeather } from "../../hooks/useWeather";
import { useNearbyStops } from "../../hooks/useTransit";
import { WeatherIcon } from "../weather/WeatherIcon";

/**
 * Composite card for a single location: weather snippet + nearest stops +
 * quick-action links. Used for both the primary saved location, secondary
 * saved locations, and the anonymous GPS card.
 *
 * The card performs its own data fetching so the parent stays a thin
 * composition. Roadmap §6 Phase 1 calls explicitly for "client-side
 * composition only" — three parallel fetches per card, no server-side
 * aggregation.
 */
export interface LocationCardProps {
  lat: number;
  lon: number;
  name: string;
  region?: string | null;
  /** When true, render the "primary" badge and use h3 for the heading. */
  isPrimary?: boolean;
  /** Saved location's id, when present — enables the saved-row link. */
  savedId?: string;
  /** Home / work shortcuts the user has saved (for plan-trip buttons). */
  shortcuts?: SavedLocationShortcuts;
}

export interface SavedLocationShortcuts {
  home?: SavedLocation;
  work?: SavedLocation;
}

const NEARBY_RADIUS_M = 500;
const STOPS_VISIBLE = 4;

export function LocationCard({
  lat,
  lon,
  name,
  region,
  isPrimary,
  shortcuts,
}: LocationCardProps) {
  const weather = useCurrentWeather(lat, lon);
  const stops = useNearbyStops(lat, lon, NEARBY_RADIUS_M);

  return (
    <article
      className={`dashboard-card${isPrimary ? " dashboard-card--primary" : ""}`}
      aria-labelledby={`card-${lat}-${lon}-heading`}
    >
      <header className="dashboard-card__header">
        <h3 id={`card-${lat}-${lon}-heading`}>{name}</h3>
        {isPrimary && (
          <span className="badge">
            <FormattedMessage id="locations.primary" />
          </span>
        )}
        {region && <span className="dashboard-card__region">{region}</span>}
      </header>

      <div className="dashboard-card__weather">
        {weather.data ? (
          <>
            <WeatherIcon
              code={weather.data.data.weatherCode}
              isDay={weather.data.data.isDay}
              size={32}
            />
            <span className="dashboard-card__temp">
              {Math.round(weather.data.data.temperature)}°
            </span>
            <span className="dashboard-card__weather-desc">
              <FormattedMessage
                id={`weather.code.${weather.data.data.weatherCode}`}
                defaultMessage={weather.data.data.weatherDescription}
              />
            </span>
          </>
        ) : weather.isError ? (
          <span className="dashboard-card__weather-empty">
            <FormattedMessage id="dashboard.card.weatherUnavailable" />
          </span>
        ) : null}
      </div>

      <div className="dashboard-card__stops">
        <h4>
          <FormattedMessage id="dashboard.card.nearestStops" />
        </h4>
        {stops.data?.data && stops.data.data.length > 0 ? (
          <ul>
            {stops.data.data.slice(0, STOPS_VISIBLE).map((stop) => (
              <li key={stop.gtfsId}>
                <span className="stop-mode">{stop.vehicleMode}</span>
                <span className="stop-name">{stop.name}</span>
                {stop.distance !== undefined && (
                  <span className="stop-distance">
                    {Math.round(stop.distance)} m
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : stops.data ? (
          <p className="help">
            <FormattedMessage id="dashboard.card.nearestStopsNone" />
          </p>
        ) : null}
      </div>

      <div className="dashboard-card__actions">
        <Link to={`/map?lat=${lat}&lon=${lon}`}>
          <FormattedMessage id="dashboard.card.openOnMap" />
        </Link>
        {shortcuts?.home && shortcuts.home.id !== "" && (
          <Link
            to={`/transit?toLat=${shortcuts.home.latitude}&toLon=${shortcuts.home.longitude}&fromLat=${lat}&fromLon=${lon}`}
          >
            <FormattedMessage id="dashboard.card.planTripToHome" />
          </Link>
        )}
        {shortcuts?.work && shortcuts.work.id !== "" && (
          <Link
            to={`/transit?toLat=${shortcuts.work.latitude}&toLon=${shortcuts.work.longitude}&fromLat=${lat}&fromLon=${lon}`}
          >
            <FormattedMessage id="dashboard.card.planTripToWork" />
          </Link>
        )}
      </div>
    </article>
  );
}
