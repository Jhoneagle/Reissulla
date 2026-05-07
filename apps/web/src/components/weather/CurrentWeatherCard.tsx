import type { CurrentWeather } from "@reissulla/shared";
import { WeatherIcon } from "./WeatherIcon";
import { windDirectionLabel, timeAgo } from "../../lib/weather-utils";

interface CurrentWeatherCardProps {
  data: CurrentWeather | undefined;
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  dataUpdatedAt: number;
  onRetry?: () => void;
}

export function CurrentWeatherCard({
  data,
  isLoading,
  isError,
  isStale,
  dataUpdatedAt,
  onRetry,
}: CurrentWeatherCardProps) {
  if (isLoading) {
    return (
      <section className="weather-card weather-card--loading" aria-label="Loading weather">
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
      <section className="weather-card weather-card--error" aria-label="Weather unavailable">
        <div className="weather-error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>Weather data temporarily unavailable</p>
          {onRetry && (
            <button type="button" className="weather-retry" onClick={onRetry}>
              Try again
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

  return (
    <section className="weather-card" aria-label="Current weather">
      {isStale && (
        <div className="weather-stale" role="status">
          Last updated {updatedLabel} — refreshing…
        </div>
      )}

      <div className="weather-current">
        <WeatherIcon
          code={data.weatherCode}
          isDay={data.isDay}
          size={40}
          className="weather-current__icon"
          label={data.weatherDescription}
        />
        <div className="weather-current__main">
          <span className="weather-current__temp">
            {Math.round(data.temperature)}°
          </span>
          <span className="weather-current__desc">
            {data.weatherDescription}
          </span>
        </div>
      </div>

      <dl className="weather-details">
        <div className="weather-detail">
          <dt>Feels like</dt>
          <dd>{Math.round(data.feelsLike)}°</dd>
        </div>
        <div className="weather-detail">
          <dt>Wind</dt>
          <dd>
            {Math.round(data.windSpeed)} m/s {windDirectionLabel(data.windDirection)}
          </dd>
        </div>
        <div className="weather-detail">
          <dt>Humidity</dt>
          <dd>{data.humidity}%</dd>
        </div>
      </dl>

      {!isStale && (
        <p className="weather-timestamp">
          Updated {updatedLabel}
        </p>
      )}
    </section>
  );
}
