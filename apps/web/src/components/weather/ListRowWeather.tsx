import { FormattedMessage } from "react-intl";
import { useCurrentWeather } from "../../hooks/useWeather";
import { WeatherIcon } from "./WeatherIcon";
import { useWeatherDescription } from "../../lib/weather-i18n";

interface ListRowWeatherProps {
  lat: number;
  lon: number;
}

export function ListRowWeather({ lat, lon }: ListRowWeatherProps) {
  const { data, isLoading, isError } = useCurrentWeather(lat, lon);
  const description = useWeatherDescription(data?.data.weatherCode ?? 0);

  if (isLoading) {
    return (
      <span className="cell-weather--loading">
        <FormattedMessage id="weather.loading" />
      </span>
    );
  }

  if (isError || !data) {
    return (
      <span className="cell-weather--error" aria-hidden="true">
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}—
      </span>
    );
  }

  const w = data.data;

  return (
    <div className="cell-weather__inner">
      <WeatherIcon
        code={w.weatherCode}
        isDay={w.isDay}
        size={16}
        className="cell-weather__icon"
      />
      <span className="cell-weather__temp">
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
        {Math.round(w.temperature)}°
      </span>
      <span className="cell-weather__desc">{description}</span>
    </div>
  );
}
