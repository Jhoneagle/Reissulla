import { HttpResponse, http } from "msw";
import {
  autocompleteByText,
  searchByText,
  searchStructuredByText,
  reverseByCoord,
  peliasUtils,
} from "@reissulla/test-fixtures/external/digitransit-pelias/registries.js";
import { isErrorMarker } from "@reissulla/test-fixtures/external/digitransit-pelias/index.js";
import { recordRequest } from "../request-log.js";

const PELIAS_BASE = "https://api.digitransit.fi/geocoding/v1";

function endpointHandler(
  endpointName: "autocomplete" | "search" | "search/structured" | "reverse",
) {
  return http.get(`${PELIAS_BASE}/${endpointName}`, async ({ request }) => {
    const url = new URL(request.url);
    recordRequest({
      url: request.url,
      method: request.method,
      body: null,
      headers: Object.fromEntries(request.headers.entries()),
    });

    let fixture;
    let key: string;
    if (endpointName === "reverse") {
      const lat = Number(url.searchParams.get("point.lat"));
      const lon = Number(url.searchParams.get("point.lon"));
      key = peliasUtils.coordKey(lat, lon);
      fixture = reverseByCoord[key];
    } else {
      const text = url.searchParams.get("text") ?? "";
      key = peliasUtils.normalizeQuery(text);
      const registry =
        endpointName === "autocomplete"
          ? autocompleteByText
          : endpointName === "search"
            ? searchByText
            : searchStructuredByText;
      fixture = registry[key];
    }

    if (fixture === undefined) {
      throw new Error(
        `Pelias MSW handler — no fixture for ${endpointName} "${key}". Add it to packages/test-fixtures/src/external/digitransit-pelias/registries.ts.`,
      );
    }
    if (isErrorMarker(fixture)) {
      if (fixture.httpError === 0) return HttpResponse.error();
      return new HttpResponse(`Mock error ${fixture.httpError}`, {
        status: fixture.httpError,
      });
    }
    return HttpResponse.json(fixture);
  });
}

export const digitransitPeliasHandlers = [
  endpointHandler("autocomplete"),
  endpointHandler("search"),
  endpointHandler("search/structured"),
  endpointHandler("reverse"),
];
