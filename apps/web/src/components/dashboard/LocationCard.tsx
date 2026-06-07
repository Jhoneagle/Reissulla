import { useMemo } from "react";
import { Link } from "react-router";
import { FormattedMessage, useIntl } from "react-intl";
import { useWeatherSnapshot } from "../../hooks/useWeather";
import { useNearbyStops } from "../../hooks/useTransit";
import { WeatherIcon } from "../weather/WeatherIcon";
import { formatWeatherCode } from "../../lib/weather-i18n";
import { HourlyForecast } from "../weather/HourlyForecast";
import { ForecastStrip } from "../weather/ForecastStrip";
import { AirQualityChip } from "../weather/AirQualityChip";
import { SunWindowCard } from "../weather/SunWindowCard";
import { WarningBanner } from "../weather/WarningBanner";
import { RoadConditionChip } from "../weather/RoadConditionChip";
import { RainNowcast } from "../weather/RainNowcast";
import {
  buildWeatherLede,
  type CardinalDirection,
  type WindBucket,
} from "../../lib/lede";
import { useWeatherTheme } from "../../hooks/useWeatherTheme";

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
  const snapshot = useWeatherSnapshot(lat, lon);
  const stops = useNearbyStops(lat, lon, { radius: NEARBY_RADIUS_M });
  const intl = useIntl();

  const current = snapshot.data?.data.current ?? null;
  const forecast = snapshot.data?.data.forecast ?? null;
  const airQuality = snapshot.data?.data.airQuality ?? null;
  const pollen = snapshot.data?.data.pollen ?? null;
  const warnings = snapshot.data?.data.warnings ?? [];
  const roadConditions = snapshot.data?.data.roadConditions ?? null;

  // Only the primary card drives the page-level ambient theme — having
  // every secondary card overwrite the body attribute would race. The
  // primary card is also the one whose weather the user is reading.
  useWeatherTheme(
    isPrimary ? current?.weatherCode : undefined,
    isPrimary ? current?.isDay : undefined,
  );

  const tempRounded = current ? Math.round(current.temperature) : null;

  // Memoise the formatters object: useMemo keyed on intl.locale so we
  // don't rebuild on every parent re-render, but do swap catalogues
  // when the user changes language.
  const ledeFormatters = useMemo(
    () => ({
      formatWind: (
        direction: CardinalDirection | "Variable",
        bucket: WindBucket,
      ) => intl.formatMessage({ id: "lede.wind" }, { direction, bucket }),
      formatCalm: () => intl.formatMessage({ id: "lede.wind.calm" }),
      formatSun: (
        event: "rise" | "set",
        tense: "past" | "future",
        time: string,
      ) => {
        const key =
          event === "rise"
            ? tense === "future"
              ? "lede.sun.rises_at"
              : "lede.sun.rose_at"
            : tense === "future"
              ? "lede.sun.sets_at"
              : "lede.sun.set_at";
        return intl.formatMessage({ id: key }, { time });
      },
    }),
    [intl],
  );

  const lede = current
    ? buildWeatherLede({
        weather: current,
        formatWeatherCode: (code) => formatWeatherCode(intl, code),
        ...ledeFormatters,
      })
    : null;

  return (
    <article
      className={`dashboard-card${isPrimary ? " dashboard-card--primary" : ""}`}
      aria-labelledby={`card-${lat}-${lon}-heading`}
    >
      {isPrimary && warnings.length > 0 && (
        <WarningBanner warnings={warnings} restoreFocusToId="main-content" />
      )}

      <header className="dashboard-card__header">
        <h3 id={`card-${lat}-${lon}-heading`}>{name}</h3>
        {isPrimary && (
          <span className="badge">
            <FormattedMessage id="locations.primary" />
          </span>
        )}
        {region && <span className="dashboard-card__region">{region}</span>}
      </header>

      {tempRounded !== null && current && (
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
            code={current.weatherCode}
            isDay={current.isDay}
            size={48}
          />
        </div>
      )}

      <div className="dashboard-card__body">
        {lede && (
          <p
            className="dashboard-card__lede"
            // Decorative summary; the underlying data has its own slots.
            role="presentation"
          >
            {lede}
          </p>
        )}

        {snapshot.isError && tempRounded === null && (
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
                    <span className="stops-board__name">
                      {stop.name}
                      {stop.city && (
                        <span className="stops-board__city">{stop.city}</span>
                      )}
                    </span>
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
      </div>

      {isPrimary && (
        <div className="dashboard-card__weather-depth">
          <RainNowcast lat={lat} lon={lon} />
          <HourlyForecast
            hours={forecast?.hourly}
            isLoading={snapshot.isLoading}
            isError={snapshot.isError && !forecast}
          />
          <ForecastStrip
            days={forecast?.daily}
            isLoading={snapshot.isLoading}
            isError={snapshot.isError && !forecast}
          />
          <div className="dashboard-card__ambient">
            <AirQualityChip airQuality={airQuality} pollen={pollen} />
            <SunWindowCard daily={forecast?.daily} />
          </div>
          <RoadConditionChip variant="dashboard" condition={roadConditions} />
        </div>
      )}

      <div className="dashboard-card__actions">
        <Link
          to={`/map?lat=${lat}&lon=${lon}`}
          className={isPrimary ? "btn btn--ghost btn--sm" : undefined}
        >
          <FormattedMessage id="dashboard.card.openOnMap" />
        </Link>
      </div>
    </article>
  );
}
