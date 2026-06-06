import { HttpResponse, http } from "msw";
import {
  currentByCoord,
  forecastByCoord,
  isErrorMarker,
} from "@reissulla/test-fixtures/external/open-meteo/index.js";
import { recordRequest } from "../request-log.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

function coordKey(lat: string | null, lon: string | null): string {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

export const openMeteoHandlers = [
  http.get(OPEN_METEO_BASE, async ({ request }) => {
    const url = new URL(request.url);
    recordRequest({
      url: request.url,
      method: request.method,
      body: null,
      headers: Object.fromEntries(request.headers.entries()),
    });

    const key = coordKey(
      url.searchParams.get("latitude"),
      url.searchParams.get("longitude"),
    );
    const isForecast =
      url.searchParams.has("hourly") || url.searchParams.has("daily");
    const registry = isForecast ? forecastByCoord : currentByCoord;
    const fixture = registry[key];

    if (fixture === undefined) {
      throw new Error(
        `Open-Meteo MSW handler — no fixture for ${key} (${isForecast ? "forecast" : "current"}). Add it to packages/test-fixtures/src/external/open-meteo/helsinki.ts.`,
      );
    }
    if (isErrorMarker(fixture)) {
      if (fixture.httpError === 0) return HttpResponse.error();
      return new HttpResponse(`Mock error ${fixture.httpError}`, {
        status: fixture.httpError,
      });
    }
    return HttpResponse.json(fixture);
  }),
];
