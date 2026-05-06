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

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

const AUTH_BASE = "/api/auth";

async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({
      error: { code: "AUTH_ERROR", message: res.statusText },
    }));
    const msg =
      body?.error?.message ?? body?.message ?? "Authentication failed";
    throw new ApiError(body?.error?.code ?? "AUTH_ERROR", msg, res.status);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const authApi = {
  signUp(name: string, email: string, password: string) {
    return authRequest<{ user: AuthUser }>("/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
  signIn(email: string, password: string) {
    return authRequest<{ user: AuthUser }>("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  signOut() {
    return authRequest<void>("/sign-out", { method: "POST" });
  },
  getSession() {
    return authRequest<{ user: AuthUser }>("/get-session");
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
