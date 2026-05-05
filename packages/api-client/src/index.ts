import type {
  CurrentWeather,
  WeatherForecast,
  GeocodingResult,
  ReverseGeocodingResult,
} from "@reissulla/shared";

const BASE_URL = "/api/v1";

interface ApiResponse<T> {
  data: T;
  cached: boolean;
}

interface WeatherApiResponse<T> extends ApiResponse<T> {
  coordinates: { latitude: number; longitude: number };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: { code: "UNKNOWN", message: res.statusText } }));
    throw new ApiError(body.error.code, body.error.message, res.status);
  }
  return res.json();
}

export const weatherApi = {
  getCurrent(lat: number, lon: number) {
    return request<WeatherApiResponse<CurrentWeather>>(
      `/weather/current?lat=${lat}&lon=${lon}`,
    );
  },
  getForecast(lat: number, lon: number) {
    return request<WeatherApiResponse<WeatherForecast>>(
      `/weather/forecast?lat=${lat}&lon=${lon}`,
    );
  },
};

export const geocodingApi = {
  search(query: string) {
    return request<ApiResponse<GeocodingResult[]>>(
      `/geocoding/search?q=${encodeURIComponent(query)}`,
    );
  },
  reverse(lat: number, lon: number) {
    return request<ApiResponse<ReverseGeocodingResult>>(
      `/geocoding/reverse?lat=${lat}&lon=${lon}`,
    );
  },
};

export const healthApi = {
  check() {
    return request<{
      status: string;
      services: { db: string; redis: string };
    }>("/health");
  },
};
