import { HttpResponse, http } from "msw";
import {
  warningsByRegion,
  isErrorMarker,
} from "@reissulla/test-fixtures/external/fmi/index.js";
import { recordRequest } from "../request-log.js";

const FMI_WFS_BASE = "https://opendata.fmi.fi/wfs";

export const fmiHandlers = [
  http.get(FMI_WFS_BASE, async ({ request }) => {
    const url = new URL(request.url);
    recordRequest({
      url: request.url,
      method: request.method,
      body: null,
      headers: Object.fromEntries(request.headers.entries()),
    });

    const storedQueryId = url.searchParams.get("storedquery_id") ?? "";
    if (storedQueryId !== "fmi::warnings::regional") {
      throw new Error(
        `FMI MSW handler — unsupported storedquery_id "${storedQueryId}". Only fmi::warnings::regional is wired up.`,
      );
    }

    const region = url.searchParams.get("region") ?? "";
    const fixture = warningsByRegion[region];

    if (fixture === undefined) {
      throw new Error(
        `FMI MSW handler — no warnings fixture for region "${region}". Add it to packages/test-fixtures/src/external/fmi/helsinki.ts.`,
      );
    }
    if (isErrorMarker(fixture)) {
      if (fixture.httpError === 0) return HttpResponse.error();
      return new HttpResponse(`Mock error ${fixture.httpError}`, {
        status: fixture.httpError,
      });
    }
    return new HttpResponse(fixture, {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  }),
];
