export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  weatherDescription: string;
  isDay: boolean;
  timestamp: string;
  // Phase 3 — optional additions on the existing surface. Adapters fill them
  // when Open-Meteo's response carries the field; older consumers ignore.
  /** Liquid-equivalent precipitation for the current hour (mm). */
  precipitation?: number;
  /** Snowfall for the current hour (cm). */
  snowfall?: number;
  /** Wind gust 10m, sampled over the last hour (m/s). */
  windGust?: number;
  /** Open-Meteo UV index for the current hour. */
  uvIndex?: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  precipitationProbability: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
  // Phase 3 — optional additions for the hourly graph and the rain nowcast.
  /** Apparent temperature (°C) — populated alongside `temperature`. */
  apparentTemperature?: number;
  precipitation?: number;
  snowfall?: number;
  windGust?: number;
  uvIndex?: number;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  weatherCode: number;
  weatherDescription: string;
  sunrise: string;
  sunset: string;
  // Phase 3 — daily peak UV index for the SunWindowCard / outdoor cues.
  uvIndexMax?: number;
}

export interface WeatherForecast {
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

/** WMO Weather interpretation codes (WW) used by Open-Meteo */
export const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};
