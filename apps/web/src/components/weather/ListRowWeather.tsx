import { useCurrentWeather } from "../../hooks/useWeather";
import { WeatherIcon } from "./WeatherIcon";

interface ListRowWeatherProps {
  lat: number;
  lon: number;
}

export function ListRowWeather({ lat, lon }: ListRowWeatherProps) {
  const { data, isLoading, isError } = useCurrentWeather(lat, lon);

  if (isLoading) {
    return <span className="cell-weather--loading">Loading…</span>;
  }

  if (isError || !data) {
    return <span className="cell-weather--error">—</span>;
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
      <span className="cell-weather__temp">{Math.round(w.temperature)}°</span>
      <span className="cell-weather__desc">{w.weatherDescription}</span>
    </div>
  );
}
