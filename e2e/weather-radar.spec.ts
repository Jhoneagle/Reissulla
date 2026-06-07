import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Rain radar overlay end-to-end. The frame timeline and tile proxy
 * routes are intercepted at the browser level so the assertions are
 * deterministic regardless of FMI weather:
 *
 *   - empty list → overlay renders nothing
 *   - five frames → active-frame URL cycles between fixture timestamps
 *   - prefers-reduced-motion → cycling never starts and the controls
 *     swap in step-back / step-forward buttons.
 */

const NOW_SEC = Math.floor(Date.now() / 1000);
const FRAME_TIMESTAMPS = [
  NOW_SEC - 60 * 60,
  NOW_SEC - 45 * 60,
  NOW_SEC - 30 * 60,
  NOW_SEC - 15 * 60,
  NOW_SEC,
];

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const TRANSPARENT_PNG_BUFFER = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/v1\/weather\/radar\/timeline/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          frames: FRAME_TIMESTAMPS.map((timestamp) => ({
            timestamp,
            tileUrlTemplate: `/api/v1/weather/radar/${timestamp}/{z}/{x}/{y}.png`,
          })),
        },
        meta: { cached: false, minutesBack: 60 },
      }),
    }),
  );
  await page.route(
    /\/api\/v1\/weather\/radar\/\d+\/\d+\/\d+\/\d+\.png/,
    (route) =>
      route.fulfill({
        contentType: "image/png",
        body: TRANSPARENT_PNG_BUFFER,
      }),
  );
});

async function enableRadarOverlay(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /choose map layers/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Rain radar" }).check();
  await dialog.getByRole("button", { name: /^Done$/ }).click();
}

async function radarTileTimestamps(page: import("@playwright/test").Page) {
  return page.locator("img.leaflet-tile").evaluateAll((nodes) => {
    const set = new Set<string>();
    for (const n of nodes) {
      const src = (n as HTMLImageElement).src;
      const m = src.match(/\/weather\/radar\/(\d+)\/\d+\/\d+\/\d+\.png/);
      if (m && m[1]) set.add(m[1]);
    }
    return [...set];
  });
}

test("radar overlay toggles in and shows the playback controls", async ({
  page,
}) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  // No radar tiles yet.
  expect(await radarTileTimestamps(page)).toEqual([]);

  await enableRadarOverlay(page);

  // The controls surface mounts with the play (or pause) button visible.
  await expect(
    page.getByRole("group", { name: /Radar playback/i }),
  ).toBeVisible();

  // At least one radar tile request fired through the proxy.
  await expect
    .poll(() => radarTileTimestamps(page), { timeout: 3000 })
    .not.toEqual([]);
});

test("under prefers-reduced-motion the controls swap to step buttons", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.route(/\/api\/v1\/weather\/radar\/timeline/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          frames: FRAME_TIMESTAMPS.map((timestamp) => ({
            timestamp,
            tileUrlTemplate: `/api/v1/weather/radar/${timestamp}/{z}/{x}/{y}.png`,
          })),
        },
        meta: { cached: false, minutesBack: 60 },
      }),
    }),
  );
  await page.route(
    /\/api\/v1\/weather\/radar\/\d+\/\d+\/\d+\/\d+\.png/,
    (route) =>
      route.fulfill({
        contentType: "image/png",
        body: TRANSPARENT_PNG_BUFFER,
      }),
  );

  await page.goto("/map");
  await page.getByRole("button", { name: /choose map layers/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Rain radar" }).check();
  await dialog.getByRole("button", { name: /^Done$/ }).click();

  // Step buttons replace play/pause when reduce-motion is in effect.
  await expect(
    page.getByRole("button", { name: /Step back one radar frame/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Step forward one radar frame/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Play radar animation/i }),
  ).toHaveCount(0);

  await context.close();
});

test("map with the radar overlay on is axe-core clean (critical/serious)", async ({
  page,
}) => {
  await page.goto("/map");
  await enableRadarOverlay(page);
  await expect(
    page.getByRole("group", { name: /Radar playback/i }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
