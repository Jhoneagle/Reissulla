import { HttpResponse, http } from "msw";
import { responsesByToken } from "@reissulla/test-fixtures/external/recaptcha/index.js";
import { recordRequest } from "../request-log.js";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export const recaptchaHandlers = [
  http.post(RECAPTCHA_VERIFY_URL, async ({ request }) => {
    const bodyText = await request.text();
    recordRequest({
      url: request.url,
      method: request.method,
      body: bodyText,
      headers: Object.fromEntries(request.headers.entries()),
    });

    const params = new URLSearchParams(bodyText);
    const token = params.get("response") ?? "";
    const fixture = responsesByToken[token];

    if (fixture === undefined) {
      throw new Error(
        `reCAPTCHA MSW handler — no fixture for token "${token}". Add it to packages/test-fixtures/src/external/recaptcha/index.ts.`,
      );
    }

    if (fixture.kind === "http") {
      return new HttpResponse(`Mock error ${fixture.status}`, {
        status: fixture.status,
      });
    }
    if (fixture.kind === "network") {
      return HttpResponse.error();
    }
    return HttpResponse.json(fixture.body);
  }),
];
