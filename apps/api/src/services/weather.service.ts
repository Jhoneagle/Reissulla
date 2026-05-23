import {
  type CurrentWeather,
  type WeatherForecast,
  type HourlyForecast,
  type DailyForecast,
  WMO_CODES,
} from "@reissulla/shared";
import { cacheGet, cacheSet } from "../cache/cache.js";
import { cacheKey } from "../cache/key.js";
import {
  WEATHER_CURRENT_TTL,
  WEATHER_FORECAST_TTL,
} from "../cache/ttl.js";
import { tryCache } from "../utils/resilience.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const FETCH_TIMEOUT_MS = 10_000;

interface OpenMeteoCurrentResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    is_day: number;
  };
  latitude: number;
  longitude: number;
}

interface OpenMeteoForecastResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
  };
  latitude: number;
  longitude: number;
}

function describeCode(code: number): string {
  return WMO_CODES[code] ?? "Unknown";
}

export async function getCurrentWeather(
  lat: number,
  lon: number,
): Promise<{ data: CurrentWeather; cached: boolean }> {
  const key = cacheKey("weather", "current", 1, lat.toFixed(2), lon.toFixed(2));
  const cached = await tryCache(() => cacheGet<CurrentWeather>(key));
  if (cached) return { data: cached, cached: true };

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day",
    timezone: "auto",
  });
  const url = `${OPEN_METEO_BASE}?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status} ${res.statusText}`);
  }

  const raw: OpenMeteoCurrentResponse = await res.json();
  const c = raw.current;

  const data: CurrentWeather = {
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    weatherCode: c.weather_code,
    weatherDescription: describeCode(c.weather_code),
    isDay: c.is_day === 1,
    timestamp: c.time,
  };

  await tryCache(() => cacheSet(key, data, WEATHER_CURRENT_TTL));
  return { data, cached: false };
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
): Promise<{ data: WeatherForecast; cached: boolean }> {
  const key = cacheKey("weather", "forecast", 1, lat.toFixed(2), lon.toFixed(2));
  const cached = await tryCache(() => cacheGet<WeatherForecast>(key));
  if (cached) return { data: cached, cached: true };

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly:
      "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset",
    timezone: "auto",
    forecast_days: "7",
  });
  const url = `${OPEN_METEO_BASE}?${params}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status} ${res.statusText}`);
  }

  const raw: OpenMeteoForecastResponse = await res.json();

  const h = raw.hourly;
  const hourly: HourlyForecast[] = h.time.map((time, i) => ({
    time,
    temperature: h.temperature_2m[i]!,
    humidity: h.relative_humidity_2m[i]!,
    precipitationProbability: h.precipitation_probability[i]!,
    weatherCode: h.weather_code[i]!,
    weatherDescription: describeCode(h.weather_code[i]!),
    windSpeed: h.wind_speed_10m[i]!,
  }));

  const d = raw.daily;
  const daily: DailyForecast[] = d.time.map((date, i) => ({
    date,
    temperatureMax: d.temperature_2m_max[i]!,
    temperatureMin: d.temperature_2m_min[i]!,
    precipitationProbability: d.precipitation_probability_max[i]!,
    weatherCode: d.weather_code[i]!,
    weatherDescription: describeCode(d.weather_code[i]!),
    sunrise: d.sunrise[i]!,
    sunset: d.sunset[i]!,
  }));

  const data: WeatherForecast = { hourly, daily };
  await tryCache(() => cacheSet(key, data, WEATHER_FORECAST_TTL));
  return { data, cached: false };
}
