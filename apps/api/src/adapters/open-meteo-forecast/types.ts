/**
 * Raw Open-Meteo Forecast response shapes. Only the fields we actually request
 * are typed; extra payload from Open-Meteo is ignored at runtime.
 */

export interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    is_day: number;
    precipitation?: number;
    snowfall?: number;
    wind_gusts_10m?: number;
    uv_index?: number;
  };
}

export interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature?: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    precipitation?: number[];
    snowfall?: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_gusts_10m?: number[];
    uv_index?: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max?: number[];
  };
}
