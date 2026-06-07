import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * MAP-1 keyboard support. Leaflet's `keyboard={true}` provides the arrow /
 * `+` / `-` bindings; `MapKeyboardHandler.tsx` layers `Home` recentre and
 * stamps `role=region` + `aria-label` on the container. These tests assert
 * the surface contract rather than poke Leaflet internals: visible state
 * changes are signalled by the `.leaflet-map-pane` transform.
 *
 * Tile fetches are stubbed via the shared fixture, so the keyboard
 * handlers fire synchronously without waiting on network.
 */

async function paneTransform(page: import("@playwright/test").Page) {
  return page
    .locator(".leaflet-map-pane")
    .evaluate((el) => getComputedStyle(el).transform);
}

async function tileZoomLevel(page: import("@playwright/test").Page) {
  // Leaflet's map-pane transform doesn't reflect zoom (only pan); zoom is
  // observed via the {z} segment in each tile's src.
  return page
    .locator("img.leaflet-tile")
    .first()
    .evaluate((el) => {
      const src = (el as HTMLImageElement).src;
      const m = src.match(/\/(\d+)\/\d+\/\d+\.png/);
      return m ? Number(m[1]) : null;
    });
}

async function focusMap(page: import("@playwright/test").Page) {
  const container = page.locator(".leaflet-container");
  await expect(container).toBeVisible();
  await container.focus();
}

test("map container exposes the region role and an accessible name", async ({
  page,
}) => {
  await page.goto("/map");
  const container = page.locator(".leaflet-container");
  await expect(container).toHaveAttribute("role", "region");
  await expect(container).toHaveAttribute(
    "aria-label",
    /arrow keys to pan|plus or minus|nuolinäppäimillä|Home/i,
  );
  // Leaflet's `keyboard` option sets tabindex on the container so it is
  // reachable in the Tab sequence.
  await expect(container).toHaveAttribute("tabindex", /-?\d+/);
});

test("arrow keys pan the map", async ({ page }) => {
  await page.goto("/map");
  await focusMap(page);
  const before = await paneTransform(page);
  await page.keyboard.press("ArrowRight");
  // Leaflet pans inside a requestAnimationFrame; poll the transform.
  await expect
    .poll(() => paneTransform(page), { timeout: 2000 })
    .not.toBe(before);
});

test("+ / - keys zoom the map", async ({ page }) => {
  await page.goto("/map");
  await focusMap(page);
  // Wait for the first tile to mount so the z probe has something to read.
  await expect(page.locator("img.leaflet-tile").first()).toBeAttached();
  const z0 = await tileZoomLevel(page);
  expect(z0).not.toBeNull();

  await page.keyboard.press("Equal");
  await expect
    .poll(() => tileZoomLevel(page), { timeout: 3000 })
    .toBe((z0 ?? 0) + 1);

  await page.keyboard.press("Minus");
  await expect.poll(() => tileZoomLevel(page), { timeout: 3000 }).toBe(z0);
});

test("Home recentres after a keyboard pan", async ({ page }) => {
  await page.goto("/map");
  await focusMap(page);
  const initial = await paneTransform(page);

  // Pan a few times so we move far enough that recentre is observable.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(60);
  }
  const panned = await paneTransform(page);
  expect(panned).not.toBe(initial);

  await page.keyboard.press("Home");
  // Recentre snaps via setView and may schedule a redraw frame.
  await expect.poll(() => paneTransform(page), { timeout: 2000 }).toBe(initial);
});

test("map page is axe-core clean (critical/serious)", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
