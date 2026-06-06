import { HttpResponse, http } from "msw";

/**
 * Default handler set for FE component tests. Each handler returns a
 * deterministic empty/idle response; specific tests override via
 * `server.use()` to drive their scenario.
 */
export const internalHandlers = [
  // Auth — better-auth surface
  http.get("*/api/auth/get-session", () => HttpResponse.json(null)),
  http.post("*/api/auth/sign-in/magic-link", () =>
    HttpResponse.json({ ok: true }),
  ),
  http.post("*/api/auth/sign-out", () => HttpResponse.json({ ok: true })),

  // Reissulla API
  http.get(
    "*/api/v1/me",
    () => new HttpResponse("Unauthorized", { status: 401 }),
  ),
  http.get("*/api/v1/preferences", () =>
    HttpResponse.json({ data: { transitRegion: "all" } }),
  ),
  http.get("*/api/v1/transit/lines/search", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/lines/pinned", () =>
    HttpResponse.json({ data: [] }),
  ),
  http.get(
    "*/api/v1/transit/lines/:gtfsId",
    () => new HttpResponse("Not Found", { status: 404 }),
  ),
  http.get("*/api/v1/transit/lines/:gtfsId/departures", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/lines/:gtfsId/frequency", () =>
    HttpResponse.json({ data: null, cached: false }),
  ),
  http.get("*/api/v1/transit/stops", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/stops/search", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/stops/nearby-adaptive", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/departures", () =>
    HttpResponse.json({
      data: { stopName: null, departures: [], message: "stop not found" },
      cached: false,
    }),
  ),
  http.get("*/api/v1/transit/recent-stops", () =>
    HttpResponse.json({ data: [] }),
  ),
  http.get("*/api/v1/recent-places", () => HttpResponse.json({ data: [] })),
  http.get("*/api/v1/geocoding/search", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/geocoding/reverse", () =>
    HttpResponse.json({ data: null, cached: false }),
  ),
  http.get("*/api/v1/weather/current", () =>
    HttpResponse.json({ data: null, cached: false }),
  ),
  http.get("*/api/v1/weather/forecast", () =>
    HttpResponse.json({ data: { hourly: [], daily: [] }, cached: false }),
  ),
];
