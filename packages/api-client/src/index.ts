import type {
  CurrentWeather,
  WeatherForecast,
  GeocodingResult,
  ReverseGeocodingResult,
  SavedLocation,
  CreateLocationInput,
  UpdateLocationInput,
  RecentPlace,
  RecordVisitInput,
  TransitStop,
  TransitSubStop,
  TransitDeparturesResult,
  TransitPlanResult,
} from "@reissulla/shared";

const BASE_URL = "/api/v1";

export interface ApiResponse<T> {
  data: T;
  cached: boolean;
}

export interface WeatherApiResponse<T> extends ApiResponse<T> {
  coordinates: { latitude: number; longitude: number };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly source?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: { code: "UNKNOWN", message: res.statusText } }));
    throw new ApiError(
      body.error.code,
      body.error.message,
      res.status,
      body.error.source,
    );
  }
  return res.json();
}

async function mutationRequest<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ error: { code: "UNKNOWN", message: res.statusText } }));
    throw new ApiError(
      data.error.code,
      data.error.message,
      res.status,
      data.error.source,
    );
  }
  if (res.status === 204) return undefined as T;
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
  search(query: string, focus?: { lat: number; lon: number }) {
    const params = new URLSearchParams({ q: query });
    if (focus) {
      params.set("lat", String(focus.lat));
      params.set("lon", String(focus.lon));
    }
    return request<ApiResponse<GeocodingResult[]>>(
      `/geocoding/search?${params}`,
    );
  },
  reverse(lat: number, lon: number) {
    return request<ApiResponse<ReverseGeocodingResult>>(
      `/geocoding/reverse?lat=${lat}&lon=${lon}`,
    );
  },
};

export const locationsApi = {
  list() {
    return request<{ data: SavedLocation[] }>("/locations");
  },
  create(input: CreateLocationInput) {
    return mutationRequest<{ data: SavedLocation }>(
      "/locations",
      "POST",
      input,
    );
  },
  update(id: string, input: UpdateLocationInput) {
    return mutationRequest<{ data: SavedLocation }>(
      `/locations/${id}`,
      "PATCH",
      input,
    );
  },
  remove(id: string) {
    return mutationRequest<void>(`/locations/${id}`, "DELETE");
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
    throw new ApiError(
      body?.error?.code ?? "AUTH_ERROR",
      msg,
      res.status,
      body?.error?.source,
    );
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const authApi = {
  signUp(
    name: string,
    email: string,
    password: string,
    recaptchaToken: string,
  ) {
    return authRequest<{ user: AuthUser }>("/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password, recaptchaToken }),
    });
  },
  signIn(email: string, password: string, recaptchaToken: string) {
    return authRequest<{ user: AuthUser }>("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password, recaptchaToken }),
    });
  },
  signOut() {
    return authRequest<void>("/sign-out", { method: "POST" });
  },
  getSession() {
    return authRequest<{ user: AuthUser }>("/get-session");
  },
  /**
   * Trigger a magic-link email. Used both as an explicit "sign in by email"
   * affordance and as the fallback when password sign-in hits the
   * RECAPTCHA_FAILED envelope from the auth hook.
   */
  requestMagicLink(email: string, recaptchaToken: string) {
    return authRequest<{ status?: boolean }>("/sign-in/magic-link", {
      method: "POST",
      body: JSON.stringify({ email, recaptchaToken }),
    });
  },
};

export const recentPlacesApi = {
  list(limit?: number) {
    const path = limit
      ? `/recent-places?limit=${encodeURIComponent(String(limit))}`
      : "/recent-places";
    return request<{ data: RecentPlace[] }>(path);
  },
  /**
   * Record a visit. Increments the existing row's visit count when called
   * for coordinates the user has already visited (precision rounding lives
   * in the repo). FE checks `visitCount >= 3` to show the "save this?"
   * prompt (LOC-8).
   */
  recordVisit(input: RecordVisitInput) {
    return mutationRequest<{ data: RecentPlace }>(
      "/recent-places",
      "POST",
      input,
    );
  },
  remove(id: string) {
    return mutationRequest<void>(`/recent-places/${id}`, "DELETE");
  },
  clear() {
    return mutationRequest<void>("/recent-places", "DELETE");
  },
};

export const meApi = {
  /** Update the authenticated user's profile name (ID-7). */
  updateName(name: string) {
    return mutationRequest<{
      user: { id: string; email: string; name: string; emailVerified: boolean };
    }>("/me", "PATCH", { name });
  },
};

export const accountApi = {
  /** GDPR-style export of every user-owned table. */
  export() {
    return request<Record<string, unknown>>("/account/export");
  },
  /** Hard-delete the account and everything it owns (ID-11). */
  remove() {
    return mutationRequest<void>("/account", "DELETE");
  },
};

export const transitApi = {
  nearbyStops(lat: number, lon: number, radius?: number) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    if (radius) params.set("radius", String(radius));
    return request<ApiResponse<TransitStop[]>>(`/transit/stops?${params}`);
  },
  searchStops(query: string) {
    return request<ApiResponse<TransitStop[]>>(
      `/transit/stops/search?q=${encodeURIComponent(query)}`,
    );
  },
  departures(stopId: string, count?: number, isStation?: boolean) {
    const params = new URLSearchParams({ stopId });
    if (count) params.set("count", String(count));
    if (isStation) params.set("isStation", "true");
    return request<ApiResponse<TransitDeparturesResult>>(
      `/transit/departures?${params}`,
    );
  },
  multiDepartures(
    stopIds: string[],
    subStops?: TransitSubStop[],
    countPerStop?: number,
    totalCount?: number,
    stationId?: string,
  ) {
    const params = new URLSearchParams({ stopIds: stopIds.join(",") });
    if (subStops) params.set("subStops", JSON.stringify(subStops));
    if (stationId) params.set("stationId", stationId);
    if (countPerStop) params.set("countPerStop", String(countPerStop));
    if (totalCount) params.set("totalCount", String(totalCount));
    return request<ApiResponse<TransitDeparturesResult>>(
      `/transit/departures/multi?${params}`,
    );
  },
  plan(fromLat: number, fromLon: number, toLat: number, toLon: number) {
    return request<ApiResponse<TransitPlanResult>>(
      `/transit/plan?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`,
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
