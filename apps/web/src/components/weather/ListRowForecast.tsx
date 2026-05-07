import { useWeatherForecast } from "../../hooks/useWeather";
import { WeatherIcon } from "./WeatherIcon";
import { shortDay } from "../../lib/weather-utils";

interface ListRowForecastProps {
  lat: number;
  lon: number;
}

export function ListRowForecast({ lat, lon }: ListRowForecastProps) {
  const { data, isLoading, isError } = useWeatherForecast(lat, lon);

  if (isLoading) {
    return <span className="cell-forecast--loading">Loading…</span>;
  }

  if (isError || !data?.data.daily?.length) {
    return <span className="cell-forecast--error">—</span>;
  }

  return (
    <div className="cell-forecast__strip">
      {data.data.daily.map((day) => {
        const isToday =
          new Date(day.date).toDateString() === new Date().toDateString();
        return (
          <div
            key={day.date}
            className={`cell-forecast__day${isToday ? " cell-forecast__day--today" : ""}`}
            title={`${isToday ? "Today" : shortDay(day.date)}: ${day.weatherDescription}, ${Math.round(day.temperatureMax)}°/${Math.round(day.temperatureMin)}°`}
          >
            <span className="cell-forecast__label">
              {isToday ? "Today" : shortDay(day.date)}
            </span>
            <WeatherIcon
              code={day.weatherCode}
              isDay={true}
              size={14}
              className="cell-forecast__icon"
            />
            <span className="cell-forecast__temps">
              {Math.round(day.temperatureMax)}° {Math.round(day.temperatureMin)}°
            </span>
          </div>
        );
      })}
    </div>
  );
}
