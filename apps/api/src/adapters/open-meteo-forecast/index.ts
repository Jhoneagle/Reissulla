import {
  type CurrentWeather,
  type DailyForecast,
  type HourlyForecast,
  type WeatherForecast,
  WMO_CODES,
} from "@reissulla/shared";
import type { AdapterContext } from "../types.js";
import {
  createForecastClient,
  type OpenMeteoForecastClient,
} from "./client.js";
import type {
  OpenMeteoCurrentResponse,
  OpenMeteoForecastResponse,
} from "./types.js";

/**
 * Open-Meteo Forecast adapter. Exposes the current-weather + multi-day
 * forecast surface used by the dashboard, map weather panel, and (in Chunk 1+)
 * the weather composition service.
 *
 * Variable set extends Phase 1 with precipitation, snowfall, wind gusts,
 * UV index, and apparent temperature in the hourly track — all per
 * technical-plan §5.1. New fields land as **optional** on the shared
 * CurrentWeather / HourlyForecast / DailyForecast shapes so legacy callers
 * keep working until they opt in.
 */

const CURRENT_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "weather_code",
  "is_day",
  "precipitation",
  "snowfall",
  "wind_gusts_10m",
  "uv_index",
].join(",");

const HOURLY_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "snowfall",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "uv_index",
].join(",");

const DAILY_VARS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "weather_code",
  "sunrise",
  "sunset",
  "uv_index_max",
].join(",");

function describeCode(code: number): string {
  return WMO_CODES[code] ?? "Unknown";
}

export interface OpenMeteoForecastAdapter {
  readonly source: "open-meteo";
  readonly baseUrl: string;
  getCurrent(
    lat: number,
    lon: number,
    ctx: AdapterContext,
  ): Promise<CurrentWeather>;
  getForecast(
    lat: number,
    lon: number,
    ctx: AdapterContext,
    options?: { forecastDays?: number },
  ): Promise<WeatherForecast>;
}

function buildAdapter(
  client: OpenMeteoForecastClient,
): OpenMeteoForecastAdapter {
  return {
    source: "open-meteo",
    baseUrl: client.baseUrl,

    async getCurrent(lat, lon, ctx) {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: CURRENT_VARS,
        timezone: "auto",
      });
      const raw = await client.request<OpenMeteoCurrentResponse>(params, ctx);
      const c = raw.current;
      return {
        temperature: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        windDirection: c.wind_direction_10m,
        weatherCode: c.weather_code,
        weatherDescription: describeCode(c.weather_code),
        isDay: c.is_day === 1,
        timestamp: c.time,
        precipitation: c.precipitation,
        snowfall: c.snowfall,
        windGust: c.wind_gusts_10m,
        uvIndex: c.uv_index,
      };
    },

    async getForecast(lat, lon, ctx, options = {}) {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        hourly: HOURLY_VARS,
        daily: DAILY_VARS,
        timezone: "auto",
        forecast_days: String(options.forecastDays ?? 7),
      });
      const raw = await client.request<OpenMeteoForecastResponse>(params, ctx);

      const h = raw.hourly;
      const hourly: HourlyForecast[] = h.time.map((time, i) => ({
        time,
        temperature: h.temperature_2m[i]!,
        humidity: h.relative_humidity_2m[i]!,
        precipitationProbability: h.precipitation_probability[i]!,
        weatherCode: h.weather_code[i]!,
        weatherDescription: describeCode(h.weather_code[i]!),
        windSpeed: h.wind_speed_10m[i]!,
        apparentTemperature: h.apparent_temperature?.[i],
        precipitation: h.precipitation?.[i],
        snowfall: h.snowfall?.[i],
        windGust: h.wind_gusts_10m?.[i],
        uvIndex: h.uv_index?.[i],
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
        uvIndexMax: d.uv_index_max?.[i],
      }));

      return { hourly, daily };
    },
  };
}

export const openMeteoForecast: OpenMeteoForecastAdapter = buildAdapter(
  createForecastClient(),
);
