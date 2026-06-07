import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * LayerControl + MAP-10 share-URL contracts. The unit test in
 * `apps/web/src/components/map/__tests__/LayerControl.test.tsx` already
 * covers focus / ESC / radio-checkbox wiring against the in-process
 * store; this spec proves the same flow over the real page lifecycle:
 *
 *   - clicking a base radio swaps the rendered `<TileLayer>` source,
 *   - the URL gains `?base=…`,
 *   - the choice survives a full reload via localStorage,
 *   - a deep link with `?base=tile-hc` boots straight into that layer.
 *
 * Tiles from CARTO and OSM-HOT get the same transparent-PNG stub as the
 * baseline OSM tiles so the assertions stay deterministic offline.
 */

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const TRANSPARENT_PNG_BUFFER = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");

test.beforeEach(async ({ page }) => {
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: TRANSPARENT_PNG_BUFFER,
    }),
  );
  await page.route(/tile\.openstreetmap\.fr/, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: TRANSPARENT_PNG_BUFFER,
    }),
  );
});

async function tileSources(page: import("@playwright/test").Page) {
  return page
    .locator("img.leaflet-tile")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLImageElement).src));
}

test("default base layer renders streets tiles", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect
    .poll(() => tileSources(page), { timeout: 3000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/tile\.openstreetmap\.org/),
      ]),
    );
});

test("selecting Dark swaps tiles, writes URL state, and persists across reload", async ({
  page,
}) => {
  await page.goto("/map");
  await page.getByRole("button", { name: /choose map layers/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "Dark" }).check();
  await dialog.getByRole("button", { name: /^Done$/ }).click();

  await expect
    .poll(() => tileSources(page), { timeout: 3000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/basemaps\.cartocdn\.com\/dark_nolabels/),
      ]),
    );
  await expect(page).toHaveURL(/[?&]base=tile-dark\b/);

  // Reload — the MapStore reads from localStorage on construct, so the
  // dark layer should come back without the URL.
  await page.goto("/map");
  await expect
    .poll(() => tileSources(page), { timeout: 3000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/basemaps\.cartocdn\.com\/dark_nolabels/),
      ]),
    );
});

test("?base=tile-hc deep link boots straight into the high-contrast tile source", async ({
  page,
}) => {
  await page.goto("/map?base=tile-hc&lat=60.5&lon=24.5&z=12");
  await expect
    .poll(() => tileSources(page), { timeout: 3000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/tile\.openstreetmap\.fr\/hot/),
      ]),
    );
});

test("LayerControl dialog is axe-core clean (critical/serious)", async ({
  page,
}) => {
  await page.goto("/map");
  await page.getByRole("button", { name: /choose map layers/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
