import { FormattedMessage, useIntl } from "react-intl";
import type { CurrentWeather } from "@reissulla/shared";
import { WeatherIcon } from "./WeatherIcon";
import { formatWeatherCode } from "../../lib/weather-i18n";

interface PopupWeatherProps {
  data: CurrentWeather | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function PopupWeather({ data, isLoading, isError }: PopupWeatherProps) {
  const intl = useIntl();

  if (isLoading) {
    return (
      <div className="popup-weather popup-weather--loading">
        <div className="skel skel-inline" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="popup-weather popup-weather--error">
        <FormattedMessage id="weather.unavailable" />
      </p>
    );
  }

  const desc = formatWeatherCode(intl, data.weatherCode);
  return (
    <div
      className="popup-weather"
      aria-label={`${Math.round(data.temperature)}°C, ${desc}`}
    >
      <WeatherIcon
        code={data.weatherCode}
        isDay={data.isDay}
        size={18}
        className="popup-weather__icon"
      />
      <span className="popup-weather__temp">
        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
        {Math.round(data.temperature)}°
      </span>
      <span className="popup-weather__desc">{desc}</span>
    </div>
  );
}
