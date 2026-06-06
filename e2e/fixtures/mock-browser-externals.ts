/**
 * Playwright fixture that stubs out browser-side externals every E2E spec
 * touches:
 *
 *   - OSM tile server — `tile.openstreetmap.org/**` returns a 1x1
 *     transparent PNG. Leaflet still renders the map; tile coverage
 *     isn't part of any assertion.
 *   - grecaptcha `api.js` — `www.google.com/recaptcha/api.js` returns
 *     an empty body. The form code in `apps/web/src/lib/recaptcha.ts`
 *     tolerates a missing `grecaptcha` global and falls back to
 *     magic-link, which is what every E2E auth flow asserts anyway.
 *
 * E2E specs import `test` from this fixture instead of from
 * `@playwright/test`.
 */
import { test as base } from "@playwright/test";

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const TRANSPARENT_PNG_BUFFER = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/tile\.openstreetmap\.org/, (route) =>
      route.fulfill({
        contentType: "image/png",
        body: TRANSPARENT_PNG_BUFFER,
      }),
    );

    await page.route(/www\.google\.com\/recaptcha\/api\.js/, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "",
      }),
    );

    await use(page);
  },
});

export { expect } from "@playwright/test";
