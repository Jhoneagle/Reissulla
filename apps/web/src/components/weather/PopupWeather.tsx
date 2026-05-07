import type { CurrentWeather } from "@reissulla/shared";
import { WeatherIcon } from "./WeatherIcon";

interface PopupWeatherProps {
  data: CurrentWeather | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function PopupWeather({ data, isLoading, isError }: PopupWeatherProps) {
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
        Weather unavailable
      </p>
    );
  }

  return (
    <div className="popup-weather" aria-label={`${Math.round(data.temperature)}°C, ${data.weatherDescription}`}>
      <WeatherIcon
        code={data.weatherCode}
        isDay={data.isDay}
        size={18}
        className="popup-weather__icon"
      />
      <span className="popup-weather__temp">
        {Math.round(data.temperature)}°
      </span>
      <span className="popup-weather__desc">{data.weatherDescription}</span>
    </div>
  );
}
