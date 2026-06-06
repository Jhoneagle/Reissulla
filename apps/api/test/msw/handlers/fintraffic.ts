import { HttpResponse, http } from "msw";
import {
  isErrorMarker,
  roadConditionsRegistry,
} from "@reissulla/test-fixtures/external/fintraffic/index.js";
import { recordRequest } from "../request-log.js";

const FINTRAFFIC_DEFAULT_BASE = "https://tie.digitraffic.fi";
const ROAD_CONDITIONS_PATH =
  "/api/weather/v1/forecast-sections/road-conditions";

/**
 * Fintraffic's road-conditions endpoint is nationwide and takes no coord
 * params, so the handler always serves the registry's `"default"` entry.
 * Tests drive different scenarios by swapping that entry before each test;
 * the shared WEATHER_* error coord keys live in the registry so they survive
 * future per-coord dispatch without re-keying.
 */
export const fintrafficHandlers = [
  http.get(
    `${FINTRAFFIC_DEFAULT_BASE}${ROAD_CONDITIONS_PATH}`,
    async ({ request }) => {
      recordRequest({
        url: request.url,
        method: request.method,
        body: null,
        headers: Object.fromEntries(request.headers.entries()),
      });

      const fixture = roadConditionsRegistry["default"];
      if (fixture === undefined) {
        throw new Error(
          `Fintraffic MSW handler — no "default" fixture. Add it to packages/test-fixtures/src/external/fintraffic/helsinki.ts.`,
        );
      }
      if (isErrorMarker(fixture)) {
        if (fixture.httpError === 0) return HttpResponse.error();
        return new HttpResponse(`Mock error ${fixture.httpError}`, {
          status: fixture.httpError,
        });
      }
      return HttpResponse.json(fixture);
    },
  ),
];
