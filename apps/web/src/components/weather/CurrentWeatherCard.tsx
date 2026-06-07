import { FormattedMessage, useIntl } from "react-intl";
import type { CurrentWeather } from "@reissulla/shared";
import { WeatherIcon } from "./WeatherIcon";
import { windDirectionLabel, timeAgo } from "../../lib/weather-utils";
import { formatWeatherCode } from "../../lib/weather-i18n";

interface CurrentWeatherCardProps {
  data: CurrentWeather | undefined;
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  dataUpdatedAt: number;
  onRetry?: () => void;
}

/**
 * Show the gust line only when the gust reading is meaningfully above
 * sustained — at calm-ish wind speeds the upstream noise floor can
 * report gust > sustained by 0.3 m/s and that's not useful information.
 */
const GUST_DELTA_MS = 3;
const GUST_DELTA_FRACTION = 1.3;

/**
 * UV index thresholds follow WHO bands. We only surface the chip when
 * UV is ≥ 3 (moderate) — clear-sky winter readings sit near zero in
 * Finland and printing "UV 0" every morning is just noise.
 */
function uvBucket(uv: number): "moderate" | "high" | "very-high" | "extreme" {
  if (uv >= 11) return "extreme";
  if (uv >= 8) return "very-high";
  if (uv >= 6) return "high";
  return "moderate";
}

export function CurrentWeatherCard({
  data,
  isLoading,
  isError,
  isStale,
  dataUpdatedAt,
  onRetry,
}: CurrentWeatherCardProps) {
  const intl = useIntl();
  if (isLoading) {
    return (
      <section
        className="weather-card weather-card--loading"
        aria-label={intl.formatMessage({ id: "weather.card.loading" })}
      >
        <div className="weather-skeleton">
          <div className="skel skel-icon" />
          <div className="skel-group">
            <div className="skel skel-temp" />
            <div className="skel skel-desc" />
          </div>
        </div>
        <div className="weather-skeleton-details">
          <div className="skel skel-detail" />
          <div className="skel skel-detail" />
          <div className="skel skel-detail" />
        </div>
      </section>
    );
  }

  if (isError && !data) {
    return (
      <section
        className="weather-card weather-card--error"
        aria-label={intl.formatMessage({
          id: "weather.card.unavailable.label",
        })}
      >
        <div className="weather-error">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>
            <FormattedMessage id="weather.card.unavailable.message" />
          </p>
          {onRetry && (
            <button type="button" className="weather-retry" onClick={onRetry}>
              <FormattedMessage id="weather.card.retry" />
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!data) return null;

  const updatedLabel = dataUpdatedAt
    ? timeAgo(new Date(dataUpdatedAt).toISOString())
    : timeAgo(data.timestamp);

  const sustained = Math.round(data.windSpeed);
  const gust =
    data.windGust !== undefined ? Math.round(data.windGust) : undefined;
  const showGust =
    gust !== undefined &&
    gust >= sustained + GUST_DELTA_MS &&
    gust >= sustained * GUST_DELTA_FRACTION;

  const uv = data.uvIndex;
  const showUv = uv !== undefined && uv >= 3;
  const uvRounded = uv !== undefined ? Math.round(uv) : null;

  return (
    <section
      className="weather-card"
      aria-label={intl.formatMessage({ id: "weather.card.current.label" })}
    >
      {isStale && (
        <div className="weather-stale" role="status">
          <FormattedMessage
            id="weather.card.stale"
            values={{ time: updatedLabel }}
          />
        </div>
      )}

      <div className="weather-current">
        <WeatherIcon
          code={data.weatherCode}
          isDay={data.isDay}
          size={40}
          className="weather-current__icon"
          label={formatWeatherCode(intl, data.weatherCode)}
        />
        <div className="weather-current__main">
          <span className="weather-current__temp">
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            {Math.round(data.temperature)}°
          </span>
          <span className="weather-current__desc">
            {formatWeatherCode(intl, data.weatherCode)}
          </span>
        </div>
      </div>

      <dl className="weather-details">
        <div className="weather-detail">
          <dt>
            <FormattedMessage id="weather.card.feelsLike" />
          </dt>
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <dd>{Math.round(data.feelsLike)}°</dd>
        </div>
        <div className="weather-detail">
          <dt>
            <FormattedMessage id="weather.card.wind" />
          </dt>
          <dd>
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            {sustained} m/s {windDirectionLabel(data.windDirection)}
            {showGust && (
              <span className="weather-detail__sub">
                <FormattedMessage
                  id="weather.card.windGust"
                  values={{ gust }}
                />
              </span>
            )}
          </dd>
        </div>
        <div className="weather-detail">
          <dt>
            <FormattedMessage id="weather.card.humidity" />
          </dt>
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <dd>{data.humidity}%</dd>
        </div>
        {showUv && uvRounded !== null && (
          <div className="weather-detail">
            <dt>
              <FormattedMessage id="weather.card.uv" />
            </dt>
            <dd>
              <span className={`uv-chip uv-chip--${uvBucket(uv)}`}>
                {uvRounded}
                <span className="visually-hidden">
                  <FormattedMessage id={`weather.card.uv.${uvBucket(uv)}`} />
                </span>
              </span>
            </dd>
          </div>
        )}
      </dl>

      {!isStale && (
        <p className="weather-timestamp">
          <FormattedMessage
            id="weather.card.updated"
            values={{ time: updatedLabel }}
          />
        </p>
      )}
    </section>
  );
}
