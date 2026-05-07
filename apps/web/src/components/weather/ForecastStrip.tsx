import type { DailyForecast } from "@reissulla/shared";
import { WeatherIcon } from "./WeatherIcon";
import { shortDay } from "../../lib/weather-utils";

interface ForecastStripProps {
  days: DailyForecast[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ForecastStrip({ days, isLoading, isError }: ForecastStripProps) {
  if (isLoading) {
    return (
      <div className="forecast-strip forecast-strip--loading" aria-label="Loading forecast">
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
    <div className="forecast-strip" role="list" aria-label="7-day forecast">
      {days.map((day) => {
        const dayName = shortDay(day.date);
        const isToday =
          new Date(day.date).toDateString() === new Date().toDateString();

        return (
          <div
            key={day.date}
            className={`forecast-day${isToday ? " forecast-day--today" : ""}`}
            role="listitem"
            aria-label={`${isToday ? "Today" : dayName}: ${day.weatherDescription}, high ${Math.round(day.temperatureMax)}°, low ${Math.round(day.temperatureMin)}°${day.precipitationProbability > 0 ? `, ${day.precipitationProbability}% chance of precipitation` : ""}`}
          >
            <span className="forecast-day__label">
              {isToday ? "Today" : dayName}
            </span>
            <WeatherIcon
              code={day.weatherCode}
              isDay={true}
              size={22}
              className="forecast-day__icon"
            />
            <div className="forecast-day__temps">
              <span className="forecast-day__high">
                {Math.round(day.temperatureMax)}°
              </span>
              <span className="forecast-day__low">
                {Math.round(day.temperatureMin)}°
              </span>
            </div>
            {day.precipitationProbability > 0 && (
              <span className="forecast-day__precip">
                {day.precipitationProbability}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
