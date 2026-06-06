import { HttpResponse, http } from "msw";
import {
  airQualityByCoord,
  isErrorMarker,
} from "@reissulla/test-fixtures/external/open-meteo-air-quality/index.js";
import { recordRequest } from "../request-log.js";

const OPEN_METEO_AIR_QUALITY_BASE =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

function coordKey(lat: string | null, lon: string | null): string {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

export const openMeteoAirQualityHandlers = [
  http.get(OPEN_METEO_AIR_QUALITY_BASE, async ({ request }) => {
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
    const fixture = airQualityByCoord[key];

    if (fixture === undefined) {
      throw new Error(
        `Open-Meteo air-quality MSW handler — no fixture for ${key}. Add it to packages/test-fixtures/src/external/open-meteo-air-quality/helsinki.ts.`,
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
