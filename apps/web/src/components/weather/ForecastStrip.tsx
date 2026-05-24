import { useIntl } from "react-intl";
import type { DailyForecast } from "@reissulla/shared";
import { WeatherIcon } from "./WeatherIcon";
import { shortDay, isToday } from "../../lib/weather-utils";

interface ForecastStripProps {
  days: DailyForecast[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ForecastStrip({
  days,
  isLoading,
  isError,
}: ForecastStripProps) {
  const intl = useIntl();
  if (isLoading) {
    return (
      <div
        className="forecast-strip forecast-strip--loading"
        aria-label={intl.formatMessage({ id: "weather.forecast.loading" })}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="forecast-day forecast-day--skel">
            <div className="skel skel-day-label" />
            <div className="skel skel-day-icon" />
            <div className="skel skel-day-temps" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !days?.length) {
    return null;
  }

  return (
    <div
      className="forecast-strip"
      role="list"
      aria-label={intl.formatMessage({ id: "weather.forecast.label" })}
    >
      {days.map((day) => {
        const dayName = shortDay(day.date);
        const today = isToday(day.date);
        const todayLabel = intl.formatMessage({ id: "weather.forecast.today" });
        const ariaLabel = intl.formatMessage(
          { id: "weather.forecast.dayLabel" },
          {
            day: today ? todayLabel : dayName,
            description: day.weatherDescription,
            high: Math.round(day.temperatureMax),
            low: Math.round(day.temperatureMin),
            precip: day.precipitationProbability > 0 ? "true" : "false",
            precipChance: day.precipitationProbability,
          },
        );

        return (
          <div
            key={day.date}
            className={`forecast-day${today ? " forecast-day--today" : ""}`}
            role="listitem"
            aria-label={ariaLabel}
          >
            <span className="forecast-day__label">
              {today ? todayLabel : dayName}
            </span>
            <WeatherIcon
              code={day.weatherCode}
              isDay={true}
              size={22}
              className="forecast-day__icon"
            />
            <div className="forecast-day__temps">
              <span className="forecast-day__high">
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {Math.round(day.temperatureMax)}°
              </span>
              <span className="forecast-day__low">
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {Math.round(day.temperatureMin)}°
              </span>
            </div>
            {day.precipitationProbability > 0 && (
              <span className="forecast-day__precip">
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {day.precipitationProbability}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
