import { FormattedMessage, useIntl } from "react-intl";
import { useWeatherForecast } from "../../hooks/useWeather";
import { WeatherIcon } from "./WeatherIcon";
import { shortDay, isToday } from "../../lib/weather-utils";
import { formatWeatherCode } from "../../lib/weather-i18n";

interface ListRowForecastProps {
  lat: number;
  lon: number;
}

export function ListRowForecast({ lat, lon }: ListRowForecastProps) {
  const intl = useIntl();
  const { data, isLoading, isError } = useWeatherForecast(lat, lon);

  if (isLoading) {
    return (
      <span className="cell-forecast--loading">
        <FormattedMessage id="weather.loading" />
      </span>
    );
  }

  if (isError || !data?.data.daily?.length) {
    return (
      <span className="cell-forecast--error" aria-hidden="true">
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}—
      </span>
    );
  }

  const todayLabel = intl.formatMessage({ id: "weather.forecast.today" });

  return (
    <div className="cell-forecast__strip">
      {data.data.daily.map((day) => {
        const today = isToday(day.date);
        const dayLabel = today ? todayLabel : shortDay(day.date);
        const desc = formatWeatherCode(intl, day.weatherCode);
        return (
          <div
            key={day.date}
            className={`cell-forecast__day${today ? " cell-forecast__day--today" : ""}`}
            title={`${dayLabel}: ${desc}, ${Math.round(day.temperatureMax)}°/${Math.round(day.temperatureMin)}°`}
          >
            <span className="cell-forecast__label">{dayLabel}</span>
            <WeatherIcon
              code={day.weatherCode}
              isDay={true}
              size={14}
              className="cell-forecast__icon"
            />
            <span className="cell-forecast__temps">
              {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
              {Math.round(day.temperatureMax)}° {Math.round(day.temperatureMin)}
              {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
              °
            </span>
          </div>
        );
      })}
    </div>
  );
}
