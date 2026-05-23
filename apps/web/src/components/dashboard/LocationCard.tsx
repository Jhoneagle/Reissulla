import { Link } from "react-router";
import { FormattedMessage, useIntl } from "react-intl";
import { useCurrentWeather } from "../../hooks/useWeather";
import { useNearbyStops } from "../../hooks/useTransit";
import { WeatherIcon } from "../weather/WeatherIcon";
import { buildWeatherLede } from "../../lib/lede";

/**
 * Composite card for a single location: weather snippet + nearest stops +
 * quick-action links. Used for both the primary saved location, secondary
 * saved locations, and the anonymous GPS card.
 *
 * The card performs its own data fetching so the parent stays a thin
 * composition. Roadmap §6 Phase 1 calls explicitly for "client-side
 * composition only" — three parallel fetches per card, no server-side
 * aggregation.
 *
 * Layout (W4b.1): the primary card splits into a hero column (italic
 * serif temperature numeral, weather icon underneath) and a body
 * column (heading, lede sentence, nearest stops). DOM order remains
 * heading → temperature → lede → stops so SR users and the mobile
 * stack get the same narrative; `grid-template-areas` positions the
 * hero on the left visually.
 */
export interface LocationCardProps {
  lat: number;
  lon: number;
  name: string;
  region?: string | null;
  /** When true, render with editorial hero layout. */
  isPrimary?: boolean;
  /** Saved location's id, when present — enables the saved-row link. */
  savedId?: string;
}

const NEARBY_RADIUS_M = 500;
const STOPS_VISIBLE = 4;

export function LocationCard({
  lat,
  lon,
  name,
  region,
  isPrimary,
}: LocationCardProps) {
  const weather = useCurrentWeather(lat, lon);
  const stops = useNearbyStops(lat, lon, NEARBY_RADIUS_M);
  const intl = useIntl();

  const tempRounded = weather.data
    ? Math.round(weather.data.data.temperature)
    : null;

  const lede = weather.data
    ? buildWeatherLede({
        weather: weather.data.data,
        formatWeatherCode: (code) =>
          intl.formatMessage({
            id: `weather.code.${code}`,
            defaultMessage: weather.data!.data.weatherDescription,
          }),
        locale: intl.locale,
      })
    : null;

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

      {tempRounded !== null && (
        <div className="dashboard-card__hero">
          <span className="dashboard-card__temp">
            <span aria-hidden="true">{tempRounded}</span>
            <span aria-hidden="true" className="dashboard-card__deg">
              °
            </span>
            {/* The visible numeral is aria-hidden so SR don't read it
                twice when paired with the lede below. The
                visually-hidden span carries the announced value. */}
            <span className="visually-hidden">
              <FormattedMessage
                id="dashboard.card.tempAnnounce"
                values={{ value: tempRounded }}
              />
            </span>
          </span>
          <WeatherIcon
            code={weather.data!.data.weatherCode}
            isDay={weather.data!.data.isDay}
            size={48}
          />
        </div>
      )}

      {lede && (
        <p
          className="dashboard-card__lede"
          // Decorative summary; the underlying data has its own slots.
          role="presentation"
        >
          {lede}
        </p>
      )}

      {weather.isError && tempRounded === null && (
        <p className="dashboard-card__weather-empty">
          <FormattedMessage id="dashboard.card.weatherUnavailable" />
        </p>
      )}

      <div className="dashboard-card__stops">
        <h4>
          <FormattedMessage id="dashboard.card.nearestStops" />
        </h4>
        {stops.data?.data && stops.data.data.length > 0 ? (
          <ol className="stops-board">
            {stops.data.data.slice(0, STOPS_VISIBLE).map((stop, index) => {
              const mode = (stop.vehicleMode ?? "bus").toLowerCase();
              return (
                <li key={stop.gtfsId} className="stops-board__row">
                  <span className="stops-board__num" aria-hidden="true">
                    {`${index + 1}`.padStart(2, "0")}
                  </span>
                  <span className={`stops-board__mode mode-${mode}`}>
                    <span aria-hidden="true">{mode.toUpperCase()}</span>
                    <span className="visually-hidden">
                      <FormattedMessage
                        id={`transit.vehicleMode.${mode}`}
                        defaultMessage={mode}
                      />
                    </span>
                  </span>
                  <span className="stops-board__name">{stop.name}</span>
                  {stop.distance !== undefined && (
                    <span className="stops-board__distance">
                      {Math.round(stop.distance)} m
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
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
      </div>
    </article>
  );
}
