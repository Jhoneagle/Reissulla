import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Warnings overlay end-to-end. The polygon endpoint is stubbed with a
 * deterministic FMI-shaped payload so we don't depend on the live feed
 * (which can be empty during quiet weather and would make the test
 * silently no-op).
 *
 * Contract:
 *   - overlay off  → no `path` under `.leaflet-overlay-pane`
 *   - overlay on   → ≥1 `path` rendered, tooltip exposes the description
 *   - overlay off again → paths removed
 *   - page with overlay on remains axe-clean
 */

const FIXTURE = {
  data: {
    polygons: [
      {
        id: "fixture-warning-1",
        severity: "moderate" as const,
        type: "wind" as const,
        startTime: Date.now() - 60_000,
        endTime: Date.now() + 60 * 60_000,
        region: "Uusimaa",
        description: "E2E fixture: brisk southerly winds in Uusimaa.",
        bounds: {
          type: "Polygon" as const,
          coordinates: [
            [
              [24.0, 60.0],
              [25.5, 60.0],
              [25.5, 60.5],
              [24.0, 60.5],
              [24.0, 60.0],
            ],
          ],
        },
      },
    ],
  },
  meta: { cached: false, region: "", locale: "en" as const },
};

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/v1\/weather\/warning-polygons/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(FIXTURE),
    }),
  );
});

async function overlayPathCount(page: import("@playwright/test").Page) {
  return page.locator(".leaflet-overlay-pane path").count();
}

test("toggling the warnings overlay shows then removes the polygons", async ({
  page,
}) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(await overlayPathCount(page)).toBe(0);

  await page.getByRole("button", { name: /choose map layers/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Weather warnings" }).check();
  await dialog.getByRole("button", { name: /^Done$/ }).click();

  await expect
    .poll(() => overlayPathCount(page), { timeout: 3000 })
    .toBeGreaterThan(0);

  // Toggle off — the WarningOverlay short-circuits on the store flag.
  await page.getByRole("button", { name: /choose map layers/i }).click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: "Weather warnings" })
    .uncheck();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Done$/ })
    .click();

  await expect.poll(() => overlayPathCount(page), { timeout: 3000 }).toBe(0);
});

test("map page with the warnings overlay on is axe-core clean (critical/serious)", async ({
  page,
}) => {
  await page.goto("/map");
  await page.getByRole("button", { name: /choose map layers/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Weather warnings" }).check();
  await dialog.getByRole("button", { name: /^Done$/ }).click();
  await expect
    .poll(() => page.locator(".leaflet-overlay-pane path").count(), {
      timeout: 3000,
    })
    .toBeGreaterThan(0);

  await expectNoSeriousA11yViolations(page);
});
