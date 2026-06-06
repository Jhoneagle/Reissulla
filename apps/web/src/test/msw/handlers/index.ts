import { HttpResponse, http } from "msw";
import { recordRequest } from "../request-log.js";

async function captureBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request
      .clone()
      .json()
      .catch(() => null);
  }
  return request.clone().text();
}

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
  http.put("*/api/v1/preferences", () =>
    HttpResponse.json({ data: { transitRegion: "all" } }),
  ),

  // Lines
  http.get("*/api/v1/transit/lines/search", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/pinned-lines", () =>
    HttpResponse.json({ data: [] }),
  ),
  http.post("*/api/v1/transit/pinned-lines", async ({ request }) => {
    const body = (await captureBody(request)) as {
      gtfsId: string;
      name: string;
      vehicleMode: string;
    };
    recordRequest({ url: request.url, method: request.method, body });
    return HttpResponse.json({
      data: {
        id: `pin-${body.gtfsId}`,
        gtfsId: body.gtfsId,
        name: body.name,
        vehicleMode: body.vehicleMode,
        pinnedAt: new Date().toISOString(),
      },
    });
  }),
  http.delete(
    "*/api/v1/transit/pinned-lines/:id",
    async ({ request, params }) => {
      recordRequest({
        url: request.url,
        method: request.method,
        body: { id: params.id },
      });
      return new HttpResponse(null, { status: 204 });
    },
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

  // Stops
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
  http.get("*/api/v1/transit/departures/multi", () =>
    HttpResponse.json({ data: [], cached: false }),
  ),
  http.get("*/api/v1/transit/departures/first-last", () =>
    HttpResponse.json({ data: null, cached: false }),
  ),
  http.get("*/api/v1/transit/recent-stops", () =>
    HttpResponse.json({ data: [] }),
  ),
  http.post("*/api/v1/transit/recent-stops", () =>
    HttpResponse.json({ data: { id: "x" } }),
  ),
  http.get("*/api/v1/transit/pinned-stops", () =>
    HttpResponse.json({ data: [] }),
  ),
  http.post("*/api/v1/transit/pinned-stops", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ data: { id: "pin-stop", ...body } });
  }),
  http.delete(
    "*/api/v1/transit/pinned-stops/:id",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get("*/api/v1/transit/trip/:tripId", () =>
    HttpResponse.json({ data: null, cached: false }),
  ),

  // Geocoding / weather / recent
  http.get("*/api/v1/recent-places", () => HttpResponse.json({ data: [] })),
  http.post("*/api/v1/recent-places", () =>
    HttpResponse.json({ data: { id: "x" } }),
  ),
  http.delete(
    "*/api/v1/recent-places/:id",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.delete(
    "*/api/v1/recent-places",
    () => new HttpResponse(null, { status: 204 }),
  ),
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
