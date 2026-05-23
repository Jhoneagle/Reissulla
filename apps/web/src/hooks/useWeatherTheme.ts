import { useEffect } from "react";

/**
 * Maps a WMO weather code to a coarse "data-weather" attribute used by
 * global.css to shift the page background within the active theme.
 * See docs/design-system.md §8.
 */
export type WeatherCondition =
  | "clear-day"
  | "clear-night"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "thunder";

export function classifyWeather(
  weatherCode: number | undefined,
  isDay: boolean | undefined,
): WeatherCondition | null {
  if (weatherCode === undefined) return null;
  if (weatherCode === 0 || weatherCode === 1) {
    return isDay === false ? "clear-night" : "clear-day";
  }
  if (weatherCode === 2 || weatherCode === 3) return "cloudy";
  if (weatherCode === 45 || weatherCode === 48) return "fog";
  if (weatherCode >= 51 && weatherCode <= 67) return "rain";
  if (weatherCode >= 80 && weatherCode <= 82) return "rain";
  if (weatherCode >= 71 && weatherCode <= 77) return "snow";
  if (weatherCode >= 85 && weatherCode <= 86) return "snow";
  if (weatherCode >= 95 && weatherCode <= 99) return "thunder";
  return "cloudy";
}

/**
 * Side-effect hook: sets `body[data-weather]` based on the supplied
 * weather code. Defaults to no attribute when called with `undefined`
 * (loading / error states fall back to the plain --color-paper bg
 * with no overlay).
 */
export function useWeatherTheme(
  weatherCode: number | undefined,
  isDay: boolean | undefined,
): void {
  useEffect(() => {
    const condition = classifyWeather(weatherCode, isDay);
    const body = document.body;
    if (condition === null) {
      delete body.dataset.weather;
    } else {
      body.dataset.weather = condition;
    }
    return () => {
      delete body.dataset.weather;
    };
  }, [weatherCode, isDay]);
}
